import { prisma } from "@/lib/prisma";
import { FRONT_DESK, withAuth } from "@/lib/auth";
import { transitionAppointment } from "@/lib/domain";

export const PATCH = withAuth(FRONT_DESK, async (req, { session, params }) => {
  const { id } = await params;
  const { status, cancelReason } = await req.json();
  const appt = await prisma.appointment.findFirst({ where: { id, hospitalId: session.hospitalId } });
  if (!appt) return Response.json({ error: { code: "NOT_FOUND", message: "Appointment not found" } }, { status: 404 });

  try {
    transitionAppointment(appt.status, status);
  } catch {
    return Response.json({ error: { code: "ILLEGAL_TRANSITION", message: `${appt.status} → ${status} not allowed` } }, { status: 422 });
  }
  if (status === "CANCELLED" && !cancelReason?.trim())
    return Response.json({ error: { code: "BAD_REQUEST", message: "cancelReason required" } }, { status: 400 });

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status, ...(status === "CANCELLED" ? { cancelReason } : {}) },
  });
  await prisma.auditLog.create({
    data: { hospitalId: session.hospitalId, actorId: session.userId, action: `APPOINTMENT_${status}`, entity: "Appointment", entityId: id },
  });
  return Response.json({ data: updated });
});
