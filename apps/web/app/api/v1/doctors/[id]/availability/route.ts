import { prisma } from "@/lib/prisma";
import { ALL_STAFF, withAuth } from "@/lib/auth";
import { getFreeSlots, type DaySchedule, type ScheduleOverride } from "@/lib/domain";

export const GET = withAuth(ALL_STAFF, async (req, { session, params }) => {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD hospital-local
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Response.json({ error: { code: "BAD_REQUEST", message: "date=YYYY-MM-DD required" } }, { status: 400 });

  const doctor = await prisma.doctor.findFirst({ where: { id, hospitalId: session.hospitalId } });
  if (!doctor) return Response.json({ error: { code: "NOT_FOUND", message: "Doctor not found" } }, { status: 404 });

  const dayStart = new Date(`${date}T00:00:00+05:00`);
  const dayEnd = new Date(`${date}T23:59:59+05:00`);
  const booked = await prisma.appointment.findMany({
    where: {
      doctorId: id, hospitalId: session.hospitalId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { scheduledAt: true },
  });
  const bookedTimes = booked.map((b) => {
    // convert to hospital-local HH:MM
    const pk = new Date(b.scheduledAt.getTime() + 5 * 3600 * 1000);
    return pk.toISOString().slice(11, 16);
  });

  const slots = getFreeSlots(
    doctor.schedule as unknown as DaySchedule[],
    ((doctor.scheduleOverrides as unknown as ScheduleOverride[]) ?? []),
    date,
    bookedTimes
  );
  return Response.json({ date, slots });
});
