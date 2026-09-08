import { SubOrderStatus } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const item = await prisma.subOrder.findUnique({ where: { id }, include: { order: true } });
    if (!item) throw new ApiError("子订单不存在", 404);
    if (item.status !== SubOrderStatus.ACCEPTED) throw new ApiError("订单完成后才能评价");
    const isClient = item.order.clientId === user.id;
    const isCreator = item.creatorId === user.id;
    if (!isClient && !isCreator) throw new ApiError("没有评价该订单的权限", 403);
    const data = await body<{ rating?: number; comment?: string }>(request);
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError("评分必须为 1 到 5 的整数");
    const review = await prisma.review.create({ data: { subOrderId: id, authorId: user.id, targetId: isClient ? item.creatorId : item.order.clientId, rating, comment: required(data.comment, "评价内容") } });
    await audit(user.id, "REVIEW_CREATED", "Review", review.id, { subOrderId: id });
    return Response.json({ review }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
