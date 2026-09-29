import { prisma } from "@/lib/prisma";
import { ALL_STAFF, withAuth } from "@/lib/auth";

// Doctor's live queue: today's appointments in token order
export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  // Doctors only see their own queue
  let effectiveDoctorId = doctorId;
  if (session.role === "DOCTOR") {
    const me = await prisma.doctor.findFirst({ where: { userId: session.userId, hospitalId: session.hospitalId } });
    if (!me) return Response.json({ error: { code: "FORBIDDEN", message: "Doctor profile missing" } }, { status: 403 });
    effectiveDoctorId = me.id;
  }

  const where: Record<string, unknown> = {
    hospitalId: session.hospitalId,
    scheduledAt: { gte: new Date(`${date}T00:00:00+05:00`), lte: new Date(`${date}T23:59:59+05:00`) },
    status: { in: ["CHECKED_IN", "IN_CONSULTATION", "CONFIRMED", "PENDING"] },
  };
  if (effectiveDoctorId) where.doctorId = effectiveDoctorId;

  const data = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true, phone: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ tokenNumber: "asc" }, { scheduledAt: "asc" }],
  });
  return Response.json({ data });
});
