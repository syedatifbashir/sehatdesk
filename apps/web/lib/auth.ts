import { compare, hash } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import type { Role } from "@prisma/client";

export interface Session {
  userId: string;
  hospitalId: string;
  role: Role;
  name: string;
}

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

function secret(kind: "access" | "refresh"): string {
  const v =
    kind === "access" ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  if (!v) throw new Error(`Missing ${kind === "access" ? "JWT_SECRET" : "JWT_REFRESH_SECRET"}`);
  return v;
}

export const hashPassword = (p: string) => hash(p, 12);
export const checkPassword = (p: string, h: string) => compare(p, h);

export function signAccessToken(s: Session): string {
  return sign(s, secret("access"), { expiresIn: ACCESS_TTL });
}
export function signRefreshToken(s: Session): string {
  return sign({ ...s, kind: "refresh" }, secret("refresh"), { expiresIn: REFRESH_TTL });
}
export function verifyAccessToken(t: string): Session {
  return verify(t, secret("access")) as Session;
}
export function verifyRefreshToken(t: string): Session {
  const s = verify(t, secret("refresh")) as Session & { kind?: string };
  if (s.kind !== "refresh") throw new Error("Not a refresh token");
  const { kind, ...rest } = s;
  void kind;
  return rest;
}

export function getSessionFromRequest(req: Request): Session | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  try {
    return verifyAccessToken(h.slice(7));
  } catch {
    return null;
  }
}

type Handler = (req: Request, ctx: { session: Session; params: Promise<Record<string, string>> }) => Promise<Response>;

export function withAuth(roles: Role[], handler: Handler) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const session = getSessionFromRequest(req);
    if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Login required" } }, { status: 401 });
    if (!roles.includes(session.role))
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient role" } }, { status: 403 });
    return handler(req, { session, params: ctx.params });
  };
}

export const ALL_STAFF: Role[] = ["OWNER", "ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "LAB_STAFF"];
export const FRONT_DESK: Role[] = ["OWNER", "ADMIN", "RECEPTIONIST"];
