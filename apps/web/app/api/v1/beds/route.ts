import { prisma } from "@/lib/prisma";
import { ALL_STAFF, withAuth } from "@/lib/auth";

export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const data = await prisma.bed.findMany({
    where: { hospitalId: session.hospitalId },
    include: { room: { include: { ward: { select: { name: true } } } } },
    orderBy: [{ room: { roomNo: "asc" } }, { bedNo: "asc" }],
  });
  return Response.json({ data });
});
