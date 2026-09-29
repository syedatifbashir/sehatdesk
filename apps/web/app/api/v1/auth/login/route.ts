import { prisma } from "@/lib/prisma";
import { checkPassword, signAccessToken, signRefreshToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { phone, email, password } = await req.json();
  if (!password || (!phone && !email))
    return Response.json({ error: { code: "BAD_REQUEST", message: "Phone/email and password required" } }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      ...(phone ? { phone } : { email }),
    },
    include: { hospital: true },
  });
  if (!user || !(await checkPassword(password, user.passwordHash)))
    return Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid login" } }, { status: 401 });

  const session = { userId: user.id, hospitalId: user.hospitalId, role: user.role, name: user.name };
  return Response.json({
    accessToken: signAccessToken(session),
    refreshToken: signRefreshToken(session),
    user: { id: user.id, name: user.name, role: user.role, hospital: user.hospital.name },
  });
}
