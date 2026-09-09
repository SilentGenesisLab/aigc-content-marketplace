import { OrderMode, OrderStatus, UserRole } from "@prisma/client";
import { requireUser, ApiError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit, body, jsonError, required } from "@/lib/api";
import { invalidateOrders } from "@/lib/redis";
import { publicOrderCode } from "@/lib/business";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "hall";
    const where = scope === "mine"
      ? user.role === UserRole.CREATOR ? { applications: { some: { creatorId: user.id } } } : user.role === UserRole.ADMIN ? {} : { clientId: user.id }
      : { status: { in: [OrderStatus.OPEN, OrderStatus.SELECTING, OrderStatus.IN_PRODUCTION, OrderStatus.PENDING_ACCEPTANCE, OrderStatus.COMPLETED] } };
    const orders = await prisma.order.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { client: { select: { id: true, name: true, avatarColor: true } }, _count: { select: { applications: true, subOrders: true } }, applications: { where: { creatorId: user.id }, select: { id: true, status: true } } },
    });
    return Response.json({ orders });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser([UserRole.CLIENT]);
    const data = await body<Record<string, unknown>>(request);
    const deadline = new Date(required(data.deadline, "截止时间"));
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) throw new ApiError("截止时间必须晚于当前时间");
    const quantity = Number(data.quantity || 1);
    const slots = Number(data.slots || 1);
    const budgetAmount = Number(data.budgetAmount || 100);
    const maxRevisions = Number(data.maxRevisions ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new ApiError("成片数量应为 1 到 100 的整数");
    if (!Number.isInteger(slots) || slots < 1 || slots > 50) throw new ApiError("中选名额应为 1 到 50 的整数");
    if (!Number.isFinite(budgetAmount) || budgetAmount < 1 || budgetAmount > 10_000_000) throw new ApiError("订单预算应在 1 到 10000000 元之间");
    if (!Number.isInteger(maxRevisions) || maxRevisions < 0 || maxRevisions > 20) throw new ApiError("修改次数应为 0 到 20 的整数");
    const organization = await prisma.organization.findFirst({ where: { type: "CLIENT", members: { some: { userId: user.id } } }, orderBy: { createdAt: "asc" } });
    const order = await prisma.order.create({ data: {
      code: publicOrderCode(), clientId: user.id, title: required(data.title, "订单标题"), objective: required(data.objective, "营销目标"), topic: required(data.topic, "内容主题"),
      quantity, duration: required(data.duration, "成片时长"), platform: required(data.platform, "发布平台"), aspectRatio: required(data.aspectRatio, "画幅"), audience: required(data.audience, "目标受众"), style: required(data.style, "内容风格"),
      referenceUrls: Array.isArray(data.referenceUrls) ? data.referenceUrls.filter((x): x is string => typeof x === "string" && !!x.trim()) : [], forbiddenElements: typeof data.forbiddenElements === "string" ? data.forbiddenElements : "", deadline,
      acceptanceCriteria: required(data.acceptanceCriteria, "验收标准"), mode: data.mode === "CONTEST" ? OrderMode.CONTEST : OrderMode.MULTI_DELIVERY, slots, sampleRequired: Boolean(data.sampleRequired), budgetAmount, maxRevisions, clientOrganizationId: organization?.id,
    } });
    await audit(user.id, "ORDER_CREATED", "Order", order.id);
    await invalidateOrders();
    return Response.json({ order }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
