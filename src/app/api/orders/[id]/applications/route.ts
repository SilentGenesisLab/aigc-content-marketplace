import { UserRole } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser([UserRole.CREATOR]);
    const { id } = await context.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw new ApiError("订单不存在", 404);
    if (order.status !== "OPEN") throw new ApiError("该订单当前不接受报名");
    const data = await body<{ pitch?: string; portfolioIds?: string[] }>(request);
    const portfolioIds = Array.isArray(data.portfolioIds) ? data.portfolioIds : [];
    if (portfolioIds.length) {
      const count = await prisma.portfolio.count({ where: { id: { in: portfolioIds }, creatorId: user.id, isPublic: true } });
      if (count !== portfolioIds.length) throw new ApiError("作品集包含无效项目");
    }
    const application = await prisma.application.create({ data: { orderId: id, creatorId: user.id, pitch: required(data.pitch, "报名说明"), portfolioIds } });
    await audit(user.id, "APPLICATION_CREATED", "Application", application.id, { orderId: id });
    return Response.json({ application }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
