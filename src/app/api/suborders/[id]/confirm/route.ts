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
    if (!confirmed && !data.objection?.trim()) throw new ApiError("请填写需要协商的内容");
    const subOrder = await prisma.subOrder.update({ where: { id }, data: confirmed ? { status: SubOrderStatus.IN_PRODUCTION, creatorConfirmedAt: new Date(), objection: null } : { objection: data.objection?.trim() } });
    await audit(user.id, confirmed ? "BRIEF_CONFIRMED" : "BRIEF_OBJECTED", "SubOrder", id);
    return Response.json({ subOrder });
  } catch (error) { return jsonError(error); }
}
