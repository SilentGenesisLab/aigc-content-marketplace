import { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireUser([UserRole.ADMIN]);
    const [users, publishedOrders, applications, selected, production, completed, pendingReview, disputes] = await Promise.all([
      prisma.user.count(), prisma.order.count({ where: { publishedAt: { not: null } } }), prisma.application.count(), prisma.application.count({ where: { status: "SELECTED" } }), prisma.subOrder.count({ where: { status: { in: ["IN_PRODUCTION", "SUBMITTED", "NEEDS_CHANGES", "PENDING_ACCEPTANCE"] } } }), prisma.order.count({ where: { status: "COMPLETED" } }), prisma.order.findMany({ where: { status: "PENDING_REVIEW" }, include: { client: { select: { name: true } } }, orderBy: { createdAt: "asc" } }), prisma.dispute.findMany({ where: { status: { in: ["OPEN", "REVIEWING"] } }, include: { openedBy: { select: { name: true } }, order: { select: { code: true, title: true } } } }),
    ]);
    return Response.json({ metrics: { users, publishedOrders, applications, selectionRate: applications ? Math.round(selected / applications * 100) : null, production, completed }, pendingReview, disputes });
  } catch (error) { return jsonError(error); }
}

