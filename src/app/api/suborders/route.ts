import { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const where = user.role === UserRole.ADMIN ? {} : user.role === UserRole.CREATOR ? { creatorId: user.id } : { order: { clientId: user.id } };
    const subOrders = await prisma.subOrder.findMany({ where, orderBy: { updatedAt: "desc" }, include: { order: true, creator: { select: { id: true, name: true } }, briefSnapshot: true, deliveries: { orderBy: { version: "desc" }, include: { compliance: true, revisions: true } }, rightsReceipt: true, reviews: true } });
    return Response.json({ subOrders });
  } catch (error) { return jsonError(error); }
}

