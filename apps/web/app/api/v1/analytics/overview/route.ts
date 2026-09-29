import { prisma } from "@/lib/prisma";
import { ALL_STAFF, withAuth } from "@/lib/auth";

export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? new Date(Date.now() - 30 * 864e5).toISOString();
  const to = searchParams.get("to") ?? new Date().toISOString();
  const h = session.hospitalId;

  const [revenuePaid, posSales, appts, newPatients, waBookings] = await Promise.all([
    prisma.invoice.aggregate({ where: { hospitalId: h, createdAt: { gte: new Date(from), lte: new Date(to) } }, _sum: { paid: true } }),
    prisma.posSale.aggregate({ where: { hospitalId: h, syncedAt: { gte: new Date(from), lte: new Date(to) } }, _sum: { total: true } }),
    prisma.appointment.groupBy({ by: ["status"], where: { hospitalId: h, scheduledAt: { gte: new Date(from), lte: new Date(to) } }, _count: true }),
    prisma.patient.count({ where: { hospitalId: h, createdAt: { gte: new Date(from), lte: new Date(to) } } }),
    prisma.appointment.count({ where: { hospitalId: h, source: "WHATSAPP", scheduledAt: { gte: new Date(from), lte: new Date(to) } } }),
  ]);

  const noShows = appts.find((a) => a.status === "NO_SHOW")?._count ?? 0;
  const total = appts.reduce((s, a) => s + a._count, 0);

  return Response.json({
    revenue: (revenuePaid._sum.paid ?? 0) + (posSales._sum.total ?? 0),
    appointmentsByStatus: appts,
    noShowPct: total ? Math.round((noShows / total) * 100) : 0,
    newPatients,
    whatsappBookings: waBookings,
  });
});
