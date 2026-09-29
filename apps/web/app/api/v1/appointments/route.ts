import { prisma } from "@/lib/prisma";
import { ALL_STAFF, FRONT_DESK, withAuth } from "@/lib/auth";

export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const doctorId = searchParams.get("doctorId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { hospitalId: session.hospitalId };
  if (doctorId) where.doctorId = doctorId;
  if (status) where.status = status;
  if (date) {
    where.scheduledAt = {
      gte: new Date(`${date}T00:00:00+05:00`),
      lte: new Date(`${date}T23:59:59+05:00`),
    };
  }
  const data = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { name: true, phone: true } },
      doctor: { include: { user: { select: { name: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });
  return Response.json({ data });
});

export const POST = withAuth(FRONT_DESK, async (req, { session }) => {
  const { patientId, doctorId, scheduledAt, source, visitType, notes } = await req.json();
  if (!patientId || !doctorId || !scheduledAt)
    return Response.json({ error: { code: "BAD_REQUEST", message: "patientId, doctorId, scheduledAt required" } }, { status: 400 });

  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, hospitalId: session.hospitalId } }),
    prisma.doctor.findFirst({ where: { id: doctorId, hospitalId: session.hospitalId, isActive: true } }),
  ]);
  if (!patient || !doctor)
    return Response.json({ error: { code: "NOT_FOUND", message: "Patient or doctor not found" } }, { status: 404 });

  try {
    const appt = await prisma.appointment.create({
      data: {
        hospitalId: session.hospitalId, patientId, doctorId,
        bookedById: session.userId,
        source: source ?? "PORTAL",
        scheduledAt: new Date(scheduledAt),
        status: "PENDING",
        visitType: visitType ?? "FIRST",
        notes,
      },
      include: { patient: { select: { name: true, phone: true } } },
    });
    return Response.json({ data: appt }, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      return Response.json({ error: { code: "APPOINTMENT_SLOT_TAKEN", message: "Slot just taken — pick another" } }, { status: 409 });
    throw e;
  }
});
