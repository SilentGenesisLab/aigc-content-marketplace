import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/auth";

export function jsonError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return Response.json({ error: "记录已存在，请勿重复提交" }, { status: 409 });
  }
  console.error(error);
  return Response.json({ error: "服务暂时不可用，请稍后重试" }, { status: 500 });
}

export async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("请求内容不是有效的 JSON", 400);
  }
}

export function required(value: unknown, label: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new ApiError(`请填写${label}`);
  return result;
}

export async function audit(actorId: string, action: string, resource: string, resourceId?: string, metadata?: Prisma.InputJsonValue) {
  const { prisma } = await import("@/lib/prisma");
  await prisma.auditLog.create({ data: { actorId, action, resource, resourceId, metadata } });
}

