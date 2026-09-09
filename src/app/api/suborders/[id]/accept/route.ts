import { DeliveryStatus, LedgerEntryType, OrderStatus, PaymentStatus, SubOrderStatus } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { orderPermission } from "@/lib/permissions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const data = await body<{ scope?: string; portfolioPermission?: boolean; verification?: string }>(request);
    const item = await prisma.subOrder.findUnique({ where: { id }, include: { order: true, payment: true, deliveries: { orderBy: { version: "desc" }, take: 1, include: { compliance: true } } } });
    if (!item) throw new ApiError("子订单不存在", 404);
    const permission=await orderPermission(item.orderId,user.id);
    if (!permission?.review) throw new ApiError("只有订单负责人或指定审核成员可以验收", 403);
    const final = item.deliveries[0];
    if (item.status !== SubOrderStatus.PENDING_ACCEPTANCE || !final?.compliance) throw new ApiError("当前没有可验收的合规交付物");
    if (!item.payment || item.payment.status !== PaymentStatus.FUNDED) throw new ApiError("托管资金状态异常，不能验收");
    required(data.verification, "验收验证说明");
    const receipt = await prisma.$transaction(async (tx) => {
      await tx.deliveryVersion.update({ where: { id: final.id }, data: { status: DeliveryStatus.FINAL } });
      await tx.subOrder.update({ where: { id }, data: { status: SubOrderStatus.ACCEPTED } });
      const created = await tx.rightsReceipt.create({ data: { subOrderId: id, finalDeliveryId: final.id, scope: required(data.scope, "商用授权范围"), portfolioPermission: Boolean(data.portfolioPermission) } });
      await tx.paymentIntent.update({where:{id:item.payment!.id},data:{status:PaymentStatus.RELEASED,releasedAt:new Date()}});
      await tx.ledgerEntry.createMany({data:[{paymentIntentId:item.payment!.id,type:LedgerEntryType.PLATFORM_FEE,amount:item.payment!.platformFee,note:"平台服务费"},{paymentIntentId:item.payment!.id,type:LedgerEntryType.RELEASE,amount:item.payment!.creatorNetAmount,note:"验收后释放创作者收入"}]});
      await tx.settlement.create({data:{paymentIntentId:item.payment!.id,amount:item.payment!.creatorNetAmount,status:PaymentStatus.RELEASED}});
      const remaining = await tx.subOrder.count({ where: { orderId: item.orderId, status: { notIn: [SubOrderStatus.ACCEPTED, SubOrderStatus.CANCELLED] } } });
      if (remaining === 0) await tx.order.update({ where: { id: item.orderId }, data: { status: OrderStatus.COMPLETED } });
      return created;
    });
    await audit(user.id, "DELIVERY_ACCEPTED", "RightsReceipt", receipt.id, { subOrderId: id, verification: data.verification });
    return Response.json({ rightsReceipt: receipt });
  } catch (error) { return jsonError(error); }
}
