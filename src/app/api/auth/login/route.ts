import { compare } from "bcryptjs";
import { createSession, ApiError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { body, jsonError, required } from "@/lib/api";
import { rateLimit } from "@/lib/redis";
import { normalizePhone } from "@/lib/sms";

export async function POST(request: Request) {
  try {
    const data = await body<{ phone?: string; password?: string }>(request);
    const phone = normalizePhone(data.phone);
    if (await rateLimit(`login:${phone}`, 10, 600)) throw new ApiError("登录尝试过于频繁，请稍后再试", 429);
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, name: true, phone: true, role: true, passwordHash: true } });
    if (!user || !(await compare(required(data.password, "密码"), user.passwordHash))) throw new ApiError("手机号或密码错误", 401);
    await createSession(user);
    return Response.json({ user: await import("@/lib/auth").then(({ getSessionUser }) => getSessionUser()) });
  } catch (error) { return jsonError(error); }
}
