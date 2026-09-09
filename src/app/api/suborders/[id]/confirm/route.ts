import { SubOrderStatus, UserRole } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser([UserRole.CREATOR]);
    const { id } = await context.params;
    const data = await body<{ confirmed?: boolean; objection?: string }>(request);
    const item = await prisma.subOrder.findUnique({ where: { id } });
    if (!item) throw new ApiError("子订单不存在", 404);
    if (item.creatorId !== user.id) throw new ApiError("只有中选创作者可以确认 Brief", 403);
    if (item.status !== SubOrderStatus.PENDING_CONFIRMATION) throw new ApiError("Brief 已处理");
    const confirmed = data.confirmed === true;
    if (confirmed && item.objection && !item.objectionResolvedAt) throw new ApiError("异议尚未由发单者处理，不能确认 Brief");
    if (!confirmed && !data.objection?.trim()) throw new ApiError("请填写需要协商的内容");
    const subOrder = await prisma.subOrder.update({ where: { id }, data: confirmed ? { creatorConfirmedAt: new Date(), objection: null } : { objection: data.objection?.trim() } });
    await audit(user.id, confirmed ? "BRIEF_CONFIRMED" : "BRIEF_OBJECTED", "SubOrder", id);
    return Response.json({ subOrder });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const data = await body<{ resolution?: string }>(request);
    const item = await prisma.subOrder.findUnique({ where: { id }, include: { order: true } });
    if (!item) throw new ApiError("子订单不存在", 404);
    if (item.order.clientId !== user.id) throw new ApiError("只有发单者可以处理 Brief 异议", 403);
    if (!item.objection || item.objectionResolvedAt) throw new ApiError("当前没有待处理的 Brief 异议");
    if (!data.resolution?.trim()) throw new ApiError("请填写协商结论");
    const subOrder = await prisma.subOrder.update({ where: { id }, data: { objectionResolvedAt: new Date() } });
    await audit(user.id, "BRIEF_OBJECTION_RESOLVED", "SubOrder", id, { resolution: data.resolution.trim() });
    return Response.json({ subOrder });
  } catch (error) { return jsonError(error); }
}
