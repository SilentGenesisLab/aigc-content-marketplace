import { UserRole } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reputation } from "@/lib/business";

export async function GET() {
  try {
    const user = await requireUser([UserRole.CREATOR]);
    const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
    const portfolios = await prisma.portfolio.findMany({ where: { creatorId: user.id }, orderBy: { createdAt: "desc" } });
    const accepted = await prisma.subOrder.findMany({ where: { creatorId: user.id, status: "ACCEPTED" }, select: { order: { select: { deadline: true } }, deliveries: { where: { status: "FINAL" }, select: { createdAt: true }, take: 1 } } });
    const completed = accepted.length;
    const onTime = accepted.filter((item) => item.deliveries[0]?.createdAt <= item.order.deadline).length;
    const reviews = await prisma.review.findMany({ where: { targetId: user.id }, select: { rating: true } });
    return Response.json({ profile, portfolios, reputation: reputation(completed, onTime, reviews) });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser([UserRole.CREATOR]);
    const data = await body<{ bio?: string; skills?: string[]; platforms?: string[]; styles?: string[]; available?: boolean }>(request);
    const clean = (items: unknown) => Array.isArray(items) ? items.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim()).slice(0, 20) : [];
    const profile = await prisma.creatorProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, bio: data.bio || "", skills: clean(data.skills), platforms: clean(data.platforms), styles: clean(data.styles), available: data.available ?? true }, update: { bio: data.bio, skills: clean(data.skills), platforms: clean(data.platforms), styles: clean(data.styles), available: data.available } });
    await audit(user.id, "CREATOR_PROFILE_UPDATED", "CreatorProfile", profile.id);
    return Response.json({ profile });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser([UserRole.CREATOR]);
    const data = await body<{ title?: string; description?: string; fileUrl?: string; coverUrl?: string }>(request);
    if (!data.title?.trim() || !data.fileUrl?.trim()) throw new ApiError("请填写作品名称和文件地址");
    const portfolio = await prisma.portfolio.create({ data: { creatorId: user.id, title: data.title.trim(), description: data.description || "", fileUrl: data.fileUrl.trim(), coverUrl: data.coverUrl || null } });
    await audit(user.id, "PORTFOLIO_CREATED", "Portfolio", portfolio.id);
    return Response.json({ portfolio }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
