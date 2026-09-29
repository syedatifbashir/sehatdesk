import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { refreshToken } = await req.json();
  if (!refreshToken)
    return Response.json({ error: { code: "BAD_REQUEST", message: "refreshToken required" } }, { status: 400 });
  try {
    const session = verifyRefreshToken(refreshToken);
    return Response.json({
      accessToken: signAccessToken(session),
      refreshToken: signRefreshToken(session),
    });
  } catch {
    return Response.json({ error: { code: "INVALID_TOKEN", message: "Refresh token invalid" } }, { status: 401 });
  }
}
