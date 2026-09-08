import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/auth";
import { body, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimitWithRetry } from "@/lib/redis";
import { issueSmsCode, normalizePhone, parseSmsPurpose } from "@/lib/sms";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const data = await body<{ phone?: string; purpose?: string }>(request);
    const phone = normalizePhone(data.phone);
    const purpose = parseSmsPurpose(data.purpose);
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (purpose === "REGISTER" && user) throw new ApiError("该手机号已注册，请直接登录", 409);
    if (purpose === "LOGIN" && !user) throw new ApiError("该手机号尚未注册", 404);

    const limits = await Promise.all([
      rateLimitWithRetry(`sms:cooldown:${phone}:${purpose}`, 1, 60),
      rateLimitWithRetry(`sms:phone-day:${phone}`, 10, 86_400),
      rateLimitWithRetry(`sms:ip-hour:${clientIp(request)}`, 30, 3_600),
    ]);
    const blocked = limits.find((item) => item.limited);
    if (blocked) {
      return Response.json(
        { error: "验证码发送过于频繁，请稍后再试", requestId },
        { status: 429, headers: { "Retry-After": String(blocked.retryAfter) } },
      );
    }
    await issueSmsCode(phone, purpose);
    return Response.json({ sent: true, cooldownSeconds: 60, requestId });
  } catch (error) {
    console.error("sms_send_failed", { requestId, message: error instanceof Error ? error.message : "unknown" });
    const response = jsonError(error);
    response.headers.set("X-Request-Id", requestId);
    return response;
  }
}
