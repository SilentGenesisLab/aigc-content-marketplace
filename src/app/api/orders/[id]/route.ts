import { OrderStatus, UserRole } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, avatarColor: true } },
        applications: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
                creatorProfile: true,
                portfolios: { where: { isPublic: true } },
                reviewsReceived: { select: { rating: true } },
                _count: { select: { subOrders: { where: { status: "ACCEPTED" } } } },
              },
            },
          },
        },
        subOrders: {
          include: {
            creator: { select: { id: true, name: true } },
            deliveries: { orderBy: { version: "desc" }, include: { compliance: true } },
            rightsReceipt: true,
          },
        },
        snapshots: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!order) throw new ApiError("订单不存在", 404);
    const publicStatuses: OrderStatus[] = [OrderStatus.OPEN, OrderStatus.SELECTING, OrderStatus.IN_PRODUCTION, OrderStatus.PENDING_ACCEPTANCE, OrderStatus.COMPLETED];
    if (!publicStatuses.includes(order.status) && order.clientId !== user.id && user.role !== UserRole.ADMIN) throw new ApiError("没有查看该订单的权限", 403);
    return Response.json({ order });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) throw new ApiError("订单不存在", 404);
    if (existing.clientId !== user.id && user.role !== UserRole.ADMIN) throw new ApiError("没有修改该订单的权限", 403);
    const data = await body<{ action?: string; reviewNote?: string }>(request);
    let status: OrderStatus;
    if (data.action === "submit" && existing.status === OrderStatus.DRAFT) status = OrderStatus.PENDING_REVIEW;
    else if (data.action === "approve" && user.role === UserRole.ADMIN && existing.status === OrderStatus.PENDING_REVIEW) status = OrderStatus.OPEN;
    else if (data.action === "reject" && user.role === UserRole.ADMIN && existing.status === OrderStatus.PENDING_REVIEW) status = OrderStatus.DRAFT;
    else if (data.action === "cancel" && (existing.status === OrderStatus.DRAFT || existing.status === OrderStatus.PENDING_REVIEW || existing.status === OrderStatus.OPEN)) status = OrderStatus.CANCELLED;
    else throw new ApiError("当前状态不允许该操作");
    const order = await prisma.order.update({ where: { id }, data: { status, reviewNote: data.reviewNote, publishedAt: status === OrderStatus.OPEN ? new Date() : existing.publishedAt } });
    await audit(user.id, `ORDER_${data.action?.toUpperCase()}`, "Order", id);
    return Response.json({ order });
  } catch (error) { return jsonError(error); }
}
