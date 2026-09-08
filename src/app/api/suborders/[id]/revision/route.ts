import { DeliveryStatus, SubOrderStatus } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const item = await prisma.subOrder.findUnique({ where: { id }, include: { order: true, deliveries: { orderBy: { version: "desc" }, take: 1 } } });
    if (!item) throw new ApiError("子订单不存在", 404);
    if (item.order.clientId !== user.id) throw new ApiError("只有发单者可以提出修改", 403);
    if (item.status !== SubOrderStatus.PENDING_ACCEPTANCE || !item.deliveries[0]) throw new ApiError("当前没有待验收的交付物");
    const data = await body<{ criteria?: string; evidence?: string; note?: string }>(request);
    const revision = await prisma.$transaction(async (tx) => {
      const created = await tx.revisionRequest.create({ data: { deliveryId: item.deliveries[0].id, clientId: user.id, criteria: required(data.criteria, "不符合的验收条款"), evidence: required(data.evidence, "验证证据"), note: required(data.note, "修改说明") } });
      await tx.deliveryVersion.update({ where: { id: item.deliveries[0].id }, data: { status: DeliveryStatus.FEEDBACK } });
      await tx.subOrder.update({ where: { id }, data: { status: SubOrderStatus.NEEDS_CHANGES } });
      return created;
    });
    await audit(user.id, "REVISION_REQUESTED", "RevisionRequest", revision.id, { subOrderId: id });
    return Response.json({ revision }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
