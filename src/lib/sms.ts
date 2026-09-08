import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import Dysmsapi20170525, { SendSmsRequest } from "@alicloud/dysmsapi20170525";
import { Config } from "@alicloud/openapi-client";
import { Prisma, SmsPurpose } from "@prisma/client";
import { ApiError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

const MAX_ATTEMPTS = 5;

function codeTtlMs() {
  if (process.env.APP_ENV === "test" && process.env.SMS_CODE_TTL_SECONDS) {
    return Math.max(Number(process.env.SMS_CODE_TTL_SECONDS) || 1, 1) * 1000;
  }
  return 5 * 60 * 1000;
}

export function normalizePhone(value: unknown) {
  const phone = typeof value === "string" ? value.trim().replace(/[\s-]/g, "") : "";
  if (!/^1\d{10}$/.test(phone)) throw new ApiError("请输入正确的中国大陆手机号");
  return phone;
}

export function parseSmsPurpose(value: unknown) {
  if (value === SmsPurpose.REGISTER || value === SmsPurpose.LOGIN) return value;
  throw new ApiError("验证码用途无效");
}

function codeDigest(phone: string, purpose: SmsPurpose, code: string) {
  const secret = process.env.SMS_HASH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new ApiError("短信服务尚未完成安全配置", 503);
  return createHmac("sha256", secret).update(`${phone}:${purpose}:${code}`).digest("hex");
}

function isMemoryProvider() {
  return process.env.APP_ENV === "test" && process.env.SMS_PROVIDER === "memory" && Boolean(process.env.E2E_TEST_SECRET);
}

async function sendWithAliyun(phone: string, code: string) {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new ApiError("短信服务尚未配置，请联系平台管理员", 503);
  }
  const client = new Dysmsapi20170525(new Config({
    accessKeyId,
    accessKeySecret,
    regionId: process.env.ALIYUN_SMS_REGION_ID || "cn-hangzhou",
    endpoint: "dysmsapi.aliyuncs.com",
  }));
  const response = await client.sendSms(new SendSmsRequest({
    phoneNumbers: phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ code }),
  }));
  if (response.body?.code !== "OK") {
    console.error("sms_provider_rejected", { requestId: response.body?.requestId, code: response.body?.code });
    throw new ApiError("验证码发送失败，请稍后重试", 502);
  }
}

export async function issueSmsCode(phone: string, purpose: SmsPurpose) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const ttlMs = codeTtlMs();
  if (isMemoryProvider()) {
    const redis = getRedis();
    if (!redis) throw new ApiError("测试短信存储不可用", 503);
    if (redis.status === "wait") await redis.connect();
    await redis.set(`e2e:sms:${phone}:${purpose}`, code, "PX", ttlMs);
  } else {
    await sendWithAliyun(phone, code);
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.smsVerification.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: now },
    }),
    prisma.smsVerification.create({
      data: { phone, purpose, codeHash: codeDigest(phone, purpose, code), expiresAt: new Date(now.getTime() + ttlMs) },
    }),
  ]);
}

export async function consumeSmsCode<T = void>(
  phone: string,
  purpose: SmsPurpose,
  rawCode: unknown,
  onConsumed?: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!/^\d{6}$/.test(code)) throw new ApiError("请输入 6 位短信验证码");
  const verification = await prisma.smsVerification.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!verification || verification.expiresAt <= new Date()) throw new ApiError("验证码无效或已过期");
  if (verification.attempts >= MAX_ATTEMPTS) throw new ApiError("验证码错误次数过多，请重新获取", 429);
  const actual = Buffer.from(codeDigest(phone, purpose, code));
  const expected = Buffer.from(verification.codeHash);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    await prisma.smsVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError("验证码无效或已过期");
  }
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.smsVerification.updateMany({
      where: { id: verification.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ApiError("验证码已使用，请重新获取", 409);
    return onConsumed ? onConsumed(tx) : undefined as T;
  });
}

export async function readTestSmsCode(phone: string, purpose: SmsPurpose) {
  if (!isMemoryProvider()) return null;
  const redis = getRedis();
  if (!redis) return null;
  if (redis.status === "wait") await redis.connect();
  return redis.get(`e2e:sms:${phone}:${purpose}`);
}
