import { prisma } from "@/lib/prisma";
import { FRONT_DESK, withAuth } from "@/lib/auth";

// Check-in: CONFIRMED → CHECKED_IN + atomic token assignment per doctor/day
export const POST = withAuth(FRONT_DESK, async (req, { session, params }) => {
  const { id } = await params;
  const appt = await prisma.appointment.findFirst({ where: { id, hospitalId: session.hospitalId } });
  if (!appt) return Response.json({ error: { code: "NOT_FOUND", message: "Appointment not found" } }, { status: 404 });
  if (appt.status !== "CONFIRMED" && appt.status !== "PENDING")
    return Response.json({ error: { code: "ILLEGAL_TRANSITION", message: "Only pending/confirmed can check in" } }, { status: 422 });

  const updated = await prisma.$transaction(async (tx) => {
    if (appt.tokenNumber != null) {
      return tx.appointment.update({ where: { id }, data: { status: "CHECKED_IN" } });
    }
    // Atomic: max token for this doctor today + 1
    const dayStart = new Date(appt.scheduledAt); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(appt.scheduledAt); dayEnd.setHours(23, 59, 59, 999);
    const max = await tx.appointment.aggregate({
      where: {
        doctorId: appt.doctorId, hospitalId: session.hospitalId,
        scheduledAt: { gte: dayStart, lte: dayEnd }, tokenNumber: { not: null },
      },
      _max: { tokenNumber: true },
    });
    const next = (max._max.tokenNumber ?? 0) + 1;
    return tx.appointment.update({ where: { id }, data: { status: "CHECKED_IN", tokenNumber: next } });
  });

  return Response.json({ data: updated });
});
