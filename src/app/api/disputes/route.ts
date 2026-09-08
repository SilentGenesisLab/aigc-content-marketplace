import { UserRole } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const data = await body<{ orderId?: string; subOrderId?: string; reason?: string; evidenceUrls?: string[] }>(request);
    const orderId = required(data.orderId, "订单");
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { subOrders: true } });
    if (!order) throw new ApiError("订单不存在", 404);
    const participates = order.clientId === user.id || order.subOrders.some((item) => item.creatorId === user.id);
    if (!participates && user.role !== UserRole.ADMIN) throw new ApiError("没有发起争议的权限", 403);
    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({ data: { orderId, subOrderId: data.subOrderId || null, openedById: user.id, reason: required(data.reason, "争议说明"), evidenceUrls: Array.isArray(data.evidenceUrls) ? data.evidenceUrls : [] } });
      await tx.order.update({ where: { id: orderId }, data: { status: "DISPUTED" } });
      return created;
    });
    await audit(user.id, "DISPUTE_OPENED", "Dispute", dispute.id);
    return Response.json({ dispute }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

