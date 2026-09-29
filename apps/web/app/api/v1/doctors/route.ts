import { prisma } from "@/lib/prisma";
import { ALL_STAFF, withAuth } from "@/lib/auth";

export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const doctors = await prisma.doctor.findMany({
    where: { hospitalId: session.hospitalId, isActive: true },
    include: { user: { select: { name: true, phone: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return Response.json({
    data: doctors.map((d) => ({
      id: d.id, name: d.user.name, phone: d.user.phone,
      specialization: d.specialization, qualification: d.qualification,
      pmcNumber: d.pmcNumber, consultationFee: d.consultationFee, bio: d.bio,
    })),
  });
});
