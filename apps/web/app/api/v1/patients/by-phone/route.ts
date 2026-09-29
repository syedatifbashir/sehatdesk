import { prisma } from "@/lib/prisma";
import { ALL_STAFF, withAuth } from "@/lib/auth";

export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const { searchParams } = new URL(req.url);
  const rawPhone = searchParams.get("phone");
  // "+" in query strings often arrives decoded as a space — restore it (before trim)
  const restored = rawPhone && rawPhone.startsWith(" ") ? "+" + rawPhone.slice(1) : rawPhone;
  const phone = restored?.trim() || null;
  if (!phone) return Response.json({ error: { code: "BAD_REQUEST", message: "phone required" } }, { status: 400 });
  const patient = await prisma.patient.findFirst({
    where: { hospitalId: session.hospitalId, phone, deletedAt: null },
    include: {
      subscriptions: { where: { status: "ACTIVE" }, include: { plan: true }, orderBy: { endsAt: "desc" }, take: 1 },
    },
  });
  return Response.json({ data: patient });
});
