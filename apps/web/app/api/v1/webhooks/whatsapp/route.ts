import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// ── Meta webhook verification ──
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function validSignature(raw: string, sig: string | null): boolean {
  const secret = process.env.WA_APP_SECRET;
  if (!secret) return true; // dev fallback — set WA_APP_SECRET in production
  if (!sig?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendWhatsApp(hospitalId: string, to: string, text: string) {
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  const phoneNumberId = hospital?.waPhoneNumberId ?? process.env.WA_PHONE_NUMBER_ID;
  const token = hospital?.waAccessToken ?? process.env.WA_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.warn("[whatsapp] no credentials — message not sent:", to, text.slice(0, 60));
    return null;
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) console.error("[whatsapp] send failed", await res.text());
  return res.ok;
}

// ── Incoming messages ──
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256")))
    return new Response("Bad signature", { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return Response.json({ ok: true }); }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = value.metadata?.phone_number_id;

      // Delivery status updates → update our message ticks
      for (const st of value.statuses ?? []) {
        if (st.id) {
          const map: Record<string, string> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
          await prisma.message.updateMany({
            where: { waMessageId: st.id },
            data: { status: (map[st.status] ?? "SENT") as any },
          });
        }
      }

      for (const msg of value.messages ?? []) {
        const from: string = msg.from; // e.g. 923001234567
        const text: string = msg.text?.body?.trim() ?? "";
        if (!from) continue;

        // Route to hospital by phone_number_id (multi-tenant)
        const hospital = await prisma.hospital.findFirst({ where: { waPhoneNumberId: phoneNumberId } })
          ?? await prisma.hospital.findFirst({ orderBy: { createdAt: "asc" } }); // dev fallback: first hospital
        if (!hospital) continue;
        const e164 = from.startsWith("+") ? from : `+${from}`;

        // Dedupe (Meta retries)
        if (msg.id) {
          const dup = await prisma.message.findUnique({ where: { waMessageId: msg.id } });
          if (dup) continue;
        }

        // Find or create conversation
        let conv = await prisma.conversation.findUnique({
          where: { hospitalId_patientPhone_channel: { hospitalId: hospital.id, patientPhone: e164, channel: "WHATSAPP" } },
        });
        if (!conv) {
          const patient = await prisma.patient.findFirst({ where: { hospitalId: hospital.id, phone: e164 } });
          conv = await prisma.conversation.create({
            data: { hospitalId: hospital.id, patientId: patient?.id, patientPhone: e164 },
          });
        }

        const humanOwns = conv.botPausedUntil && conv.botPausedUntil > new Date();

        await prisma.message.create({
          data: {
            conversationId: conv.id, direction: "IN", type: msg.type?.toUpperCase() ?? "TEXT",
            body: text || `[${msg.type}]`, waMessageId: msg.id, status: "READ",
          },
        });
        await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });

        // ── n8n backend: forward when configured ──
        const n8nUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;
        if (n8nUrl) {
          await fetch(n8nUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(process.env.N8N_API_KEY ? { "X-N8N-API-KEY": process.env.N8N_API_KEY } : {}),
            },
            body: JSON.stringify({
              hospitalId: hospital.id, conversationId: conv.id, from: e164,
              text, waMessageId: msg.id, humanOwns: !!humanOwns, phoneNumberId,
            }),
          }).catch((e) => console.error("[n8n] forward failed", e));
          continue; // n8n owns the reply
        }

        // ── Built-in fallback bot (used when n8n not configured) ──
        if (!humanOwns && text) {
          const reply = await fallbackBot(hospital.id, e164, text);
          if (reply) {
            await sendWhatsApp(hospital.id, e164, reply);
            await prisma.message.create({
              data: { conversationId: conv.id, direction: "OUT", type: "TEXT", body: reply, status: "SENT" },
            });
          }
        }
      }
    }
  }
  return Response.json({ ok: true });
}

// Minimal menu bot — n8n replaces this in production
async function fallbackBot(hospitalId: string, from: string, text: string): Promise<string | null> {
  const t = text.toLowerCase();
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (/^(hi|salam|hello|aoa|assalam)/.test(t)) {
    return `Assalam-o-Alaikum! ${hospital?.name} me khush aamdeed.\n1️⃣ Book appointment\n2️⃣ Doctor timings & fees\n3️⃣ Talk to receptionist\n\nReply with the number.`;
  }
  if (t === "2") {
    const doctors = await prisma.doctor.findMany({
      where: { hospitalId, isActive: true }, include: { user: { select: { name: true } } },
    });
    if (!doctors.length) return "No doctors available right now.";
    return "Our doctors:\n" + doctors.map((d) => `• ${d.user.name} — ${d.specialization}, Rs ${d.consultationFee}`).join("\n");
  }
  if (t === "3" || t.includes("human") || t.includes("receptionist") || t.includes("insan")) {
    const conv = await prisma.conversation.findUnique({
      where: { hospitalId_patientPhone_channel: { hospitalId, patientPhone: from, channel: "WHATSAPP" } },
    });
    if (conv) await prisma.conversation.update({ where: { id: conv.id }, data: { botPausedUntil: new Date(Date.now() + 24 * 3600e3) } });
    return "Connecting you to our receptionist — please type your message. 👩‍💼";
  }
  if (t === "1") return "Great! Please tell us which doctor (reply 2 to see the list), or type the doctor's name.";
  return null; // stay silent on unknown input rather than spam
}
