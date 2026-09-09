import { OrganizationType } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const organizations = await prisma.organization.findMany({ where: { members: { some: { userId: user.id } } }, include: { members: { include: { user: { select: { id: true, name: true, phone: true } } } }, _count: { select: { clientOrders: true } } }, orderBy: { updatedAt: "desc" } });
    return Response.json({ organizations });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const data = await body<{ name?: string; type?: string; description?: string }>(request);
    if (data.type !== OrganizationType.CLIENT && data.type !== OrganizationType.CREATOR) throw new ApiError("请选择团队类型");
    const organization = await prisma.organization.create({ data: { name: required(data.name, "团队名称"), type: data.type, description: data.description?.trim() || "", creatorId: user.id, members: { create: { userId: user.id, role: "OWNER" } } } });
    await audit(user.id, "ORGANIZATION_CREATED", "Organization", organization.id);
    return Response.json({ organization }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
