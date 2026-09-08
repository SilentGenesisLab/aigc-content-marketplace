export async function GET() {
  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "connected", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}

