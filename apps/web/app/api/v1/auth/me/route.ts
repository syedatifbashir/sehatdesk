import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Login required" } }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { hospital: { select: { name: true, city: true } } },
  });
  if (!user || !user.isActive)
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Account inactive" } }, { status: 401 });
  return Response.json({
    user: { id: user.id, name: user.name, role: user.role, hospitalId: user.hospitalId, hospital: user.hospital },
  });
}
