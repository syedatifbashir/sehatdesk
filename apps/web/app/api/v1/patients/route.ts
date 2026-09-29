import { prisma } from "@/lib/prisma";
import { ALL_STAFF, FRONT_DESK, withAuth } from "@/lib/auth";

export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const patients = await prisma.patient.findMany({
    where: {
      hospitalId: session.hospitalId,
      deletedAt: null,
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  return Response.json({ data: patients });
});

export const POST = withAuth(FRONT_DESK, async (req, { session }) => {
  const { name, phone, cnic, dateOfBirth, gender, address } = await req.json();
  if (!name?.trim() || !phone?.trim())
    return Response.json({ error: { code: "BAD_REQUEST", message: "name and phone required" } }, { status: 400 });

  // Upsert by phone (per hospital) — WhatsApp bot and receptionist share this
  const patient = await prisma.patient.upsert({
    where: { hospitalId_phone: { hospitalId: session.hospitalId, phone: phone.trim() } },
    update: { name: name.trim(), cnic, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined, gender, address },
    create: {
      hospitalId: session.hospitalId, name: name.trim(), phone: phone.trim(),
      cnic, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, gender, address,
    },
  });
  return Response.json({ data: patient }, { status: 201 });
});
