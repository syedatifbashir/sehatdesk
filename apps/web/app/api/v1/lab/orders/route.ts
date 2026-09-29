import { prisma } from "@/lib/prisma";
import { ALL_STAFF, withAuth } from "@/lib/auth";

export const GET = withAuth(ALL_STAFF, async (req, { session }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const data = await prisma.labOrder.findMany({
    where: { hospitalId: session.hospitalId, ...(status ? { status: status as never } : {}) },
    include: { patient: { select: { name: true, phone: true } }, result: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({ data });
});

export const POST = withAuth(ALL_STAFF, async (req, { session }) => {
  const { patientId, testIds, visitId } = await req.json();
  if (!patientId || !Array.isArray(testIds) || !testIds.length)
    return Response.json({ error: { code: "BAD_REQUEST", message: "patientId and testIds required" } }, { status: 400 });
  const tests = await prisma.labTest.findMany({
    where: { hospitalId: session.hospitalId, id: { in: testIds }, isActive: true },
  });
  if (!tests.length)
    return Response.json({ error: { code: "NOT_FOUND", message: "No valid tests" } }, { status: 404 });
  const items = tests.map((t) => ({ testId: t.id, testName: t.name, price: t.price }));
  const order = await prisma.labOrder.create({
    data: {
      hospitalId: session.hospitalId, patientId, visitId: visitId ?? null,
      orderedById: session.userId, items, total: tests.reduce((s, t) => s + t.price, 0),
    },
  });
  return Response.json({ data: order }, { status: 201 });
});
