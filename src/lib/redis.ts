import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
    globalForRedis.redis.on("error", () => undefined);
  }
  return globalForRedis.redis;
}

export async function rateLimit(key: string, limit: number, seconds: number) {
  const redis = getRedis();
  if (!redis) return false;
  try {
    if (redis.status === "wait") await redis.connect();
    const count = await redis.incr(`limit:${key}`);
    if (count === 1) await redis.expire(`limit:${key}`, seconds);
    return count > limit;
  } catch {
    return false;
  }
}

export async function invalidateOrders() {
  const redis = getRedis();
  try {
    if (redis?.status === "wait") await redis.connect();
    await redis?.del("orders:open");
  } catch {}
}
