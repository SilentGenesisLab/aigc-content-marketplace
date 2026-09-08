import { hash } from "bcryptjs";
import { SmsPurpose, UserRole } from "@prisma/client";
import { createSession, ApiError } from "@/lib/auth";
import { body, jsonError, required, audit } from "@/lib/api";
import { rateLimit } from "@/lib/redis";
import { consumeSmsCode, normalizePhone } from "@/lib/sms";

export async function POST(request: Request) {
  try {
    const data = await body<{ phone?: string; password?: string; name?: string; role?: string; smsCode?: string }>(request);
    const phone = normalizePhone(data.phone);
    if (await rateLimit(`register:${phone}`, 5, 600)) throw new ApiError("注册尝试过于频繁，请稍后再试", 429);
    const password = required(data.password, "密码");
    if (password.length < 8) throw new ApiError("密码至少 8 位");
    const role = data.role === "CREATOR" ? UserRole.CREATOR : UserRole.CLIENT;
    const passwordHash = await hash(password, 12);
    const user = await consumeSmsCode(phone, SmsPurpose.REGISTER, data.smsCode, (tx) => tx.user.create({
      data: { phone, name: required(data.name, "姓名"), role, passwordHash, creatorProfile: role === UserRole.CREATOR ? { create: {} } : undefined },
      select: { id: true, name: true, phone: true, role: true },
    }));
    await createSession(user);
    await audit(user.id, "USER_REGISTERED", "User", user.id);
    return Response.json({ user }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
