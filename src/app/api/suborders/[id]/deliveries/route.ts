import { SubOrderStatus, UserRole } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { nextDeliveryVersion } from "@/lib/business";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser([UserRole.CREATOR]);
    const { id } = await context.params;
    const item = await prisma.subOrder.findUnique({ where: { id }, include: { deliveries: { select: { version: true } } } });
    if (!item) throw new ApiError("子订单不存在", 404);
    if (item.creatorId !== user.id) throw new ApiError("只有该订单创作者可以提交", 403);
    if (item.status !== SubOrderStatus.IN_PRODUCTION && item.status !== SubOrderStatus.NEEDS_CHANGES) throw new ApiError("当前状态不能提交交付物");
    const data = await body<{ title?: string; fileUrl?: string; previewUrl?: string; note?: string; aiTools?: string[]; materialSources?: string; commercialLicense?: boolean; portraitAuthorization?: boolean; voiceAuthorization?: boolean; brandAuthorization?: boolean }>(request);
    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.deliveryVersion.create({ data: { subOrderId: id, version: nextDeliveryVersion(item.deliveries), title: required(data.title, "交付名称"), fileUrl: required(data.fileUrl, "交付文件"), previewUrl: data.previewUrl, note: data.note || "", compliance: { create: { aiTools: Array.isArray(data.aiTools) ? data.aiTools.filter(Boolean) : [], materialSources: required(data.materialSources, "素材来源说明"), commercialLicense: Boolean(data.commercialLicense), portraitAuthorization: Boolean(data.portraitAuthorization), voiceAuthorization: Boolean(data.voiceAuthorization), brandAuthorization: Boolean(data.brandAuthorization), generatedContent: true } } } });
      await tx.subOrder.update({ where: { id }, data: { status: SubOrderStatus.PENDING_ACCEPTANCE } });
      await tx.order.update({ where: { id: item.orderId }, data: { status: "PENDING_ACCEPTANCE" } });
      return created;
    });
    await audit(user.id, "DELIVERY_SUBMITTED", "DeliveryVersion", delivery.id, { subOrderId: id });
    return Response.json({ delivery }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
