import { SmsPurpose } from "@prisma/client";
import { createSession, ApiError } from "@/lib/auth";
import { audit, body, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/redis";
import { consumeSmsCode, normalizePhone } from "@/lib/sms";

export async function POST(request: Request) {
  try {
    const data = await body<{ phone?: string; smsCode?: string }>(request);
    const phone = normalizePhone(data.phone);
    if (await rateLimit(`sms-login:${phone}`, 10, 600)) throw new ApiError("登录尝试过于频繁，请稍后再试", 429);
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, name: true, phone: true, role: true } });
    if (!user) throw new ApiError("手机号或验证码错误", 401);
    await consumeSmsCode(phone, SmsPurpose.LOGIN, data.smsCode);
    await createSession(user);
    await audit(user.id, "USER_SMS_LOGIN", "User", user.id);
    return Response.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
