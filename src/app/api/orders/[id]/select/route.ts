import { ApplicationStatus, OrderMode, OrderStatus, SubOrderStatus } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError } from "@/lib/api";
import { briefContent, subOrderCode } from "@/lib/business";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const data = await body<{ applicationIds?: string[] }>(request);
    const ids = [...new Set(Array.isArray(data.applicationIds) ? data.applicationIds : [])];
    const order = await prisma.order.findUnique({ where: { id }, include: { applications: true, snapshots: { orderBy: { version: "desc" }, take: 1 }, subOrders: true } });
    if (!order) throw new ApiError("订单不存在", 404);
    if (order.clientId !== user.id) throw new ApiError("只有发单者可以选择创作者", 403);
    if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.SELECTING) throw new ApiError("当前状态不能中选");
    if (!ids.length) throw new ApiError("请至少选择一位创作者");
    const max = order.mode === OrderMode.CONTEST ? 1 : order.slots;
    if (ids.length > max) throw new ApiError(`该订单最多可选择 ${max} 位创作者`);
    const selected = order.applications.filter((item) => ids.includes(item.id));
    if (selected.length !== ids.length) throw new ApiError("选择中包含不属于该订单的报名");
    const result = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.briefSnapshot.create({ data: { orderId: id, version: (order.snapshots[0]?.version || 0) + 1, content: briefContent(order) } });
      await tx.application.updateMany({ where: { orderId: id, id: { notIn: ids }, status: { in: [ApplicationStatus.APPLIED, ApplicationStatus.SHORTLISTED] } }, data: { status: ApplicationStatus.REJECTED } });
      const created = [];
      for (let index = 0; index < selected.length; index += 1) {
        const application = selected[index];
        await tx.application.update({ where: { id: application.id }, data: { status: ApplicationStatus.SELECTED } });
        created.push(await tx.subOrder.create({ data: { code: subOrderCode(order.code, order.subOrders.length + index + 1), orderId: id, applicationId: application.id, creatorId: application.creatorId, briefSnapshotId: snapshot.id, status: SubOrderStatus.PENDING_CONFIRMATION } }));
      }
      await tx.order.update({ where: { id }, data: { status: OrderStatus.IN_PRODUCTION } });
      return created;
    });
    await audit(user.id, "CREATORS_SELECTED", "Order", id, { applicationIds: ids });
    return Response.json({ subOrders: result }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
