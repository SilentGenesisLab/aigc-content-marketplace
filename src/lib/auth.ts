import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "aigc_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "local-development-secret-change-me");
const secureCookie = () => process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";

export type SessionUser = { id: string; name: string; phone: string; role: "CLIENT" | "CREATOR" | "ADMIN" };

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, phone: user.phone, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secureCookie(), path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, phone: true, role: true } });
    return user as SessionUser | null;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: SessionUser["role"][]) {
  const user = await getSessionUser();
  if (!user) throw new ApiError("请先登录", 401);
  if (roles && !roles.includes(user.role)) throw new ApiError("没有执行该操作的权限", 403);
  return user;
}

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
