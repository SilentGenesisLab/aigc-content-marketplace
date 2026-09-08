import { DeliveryStatus, OrderStatus, SubOrderStatus } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const data = await body<{ scope?: string; portfolioPermission?: boolean; verification?: string }>(request);
    const item = await prisma.subOrder.findUnique({ where: { id }, include: { order: true, deliveries: { orderBy: { version: "desc" }, take: 1, include: { compliance: true } } } });
    if (!item) throw new ApiError("子订单不存在", 404);
    if (item.order.clientId !== user.id) throw new ApiError("只有发单者可以验收", 403);
    const final = item.deliveries[0];
    if (item.status !== SubOrderStatus.PENDING_ACCEPTANCE || !final?.compliance) throw new ApiError("当前没有可验收的合规交付物");
    required(data.verification, "验收验证说明");
    const receipt = await prisma.$transaction(async (tx) => {
      await tx.deliveryVersion.update({ where: { id: final.id }, data: { status: DeliveryStatus.FINAL } });
      await tx.subOrder.update({ where: { id }, data: { status: SubOrderStatus.ACCEPTED } });
      const created = await tx.rightsReceipt.create({ data: { subOrderId: id, finalDeliveryId: final.id, scope: required(data.scope, "商用授权范围"), portfolioPermission: Boolean(data.portfolioPermission) } });
      const remaining = await tx.subOrder.count({ where: { orderId: item.orderId, status: { notIn: [SubOrderStatus.ACCEPTED, SubOrderStatus.CANCELLED] } } });
      if (remaining === 0) await tx.order.update({ where: { id: item.orderId }, data: { status: OrderStatus.COMPLETED } });
      return created;
    });
    await audit(user.id, "DELIVERY_ACCEPTED", "RightsReceipt", receipt.id, { subOrderId: id, verification: data.verification });
    return Response.json({ rightsReceipt: receipt });
  } catch (error) { return jsonError(error); }
}
