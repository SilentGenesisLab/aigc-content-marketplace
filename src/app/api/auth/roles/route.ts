import { UserRole } from "@prisma/client";
import { ApiError, createSession, requireUser } from "@/lib/auth";
import { audit, body, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const organizations = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ user, organizations });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const data = await body<{ role?: string }>(request);
    if (data.role !== UserRole.CLIENT && data.role !== UserRole.CREATOR && data.role !== UserRole.ADMIN) throw new ApiError("身份无效");
    if (data.role === UserRole.ADMIN && !user.roles.includes(UserRole.ADMIN)) throw new ApiError("管理员身份只能由平台内部授予", 403);
    if (user.roles.includes(UserRole.ADMIN) && !user.roles.includes(data.role)) throw new ApiError("平台管理员不能自行开通业务身份", 403);
    if (!user.roles.includes(data.role)) {
      await prisma.$transaction(async (tx) => {
        await tx.userRoleAssignment.create({ data: { userId: user.id, role: data.role as UserRole } });
        if (data.role === UserRole.CREATOR) await tx.creatorProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
        const organization = await tx.organization.create({ data: { name: `${user.name}的${data.role === UserRole.CREATOR ? "制作" : "发布"}工作空间`, type: data.role === UserRole.CREATOR ? "CREATOR" : "CLIENT", creatorId: user.id } });
        await tx.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, role: "OWNER" } });
      });
      await audit(user.id, "BUSINESS_ROLE_ENABLED", "User", user.id, { role: data.role });
    }
    await createSession({ ...user, role: data.role as UserRole });
    return Response.json({ role: data.role });
  } catch (error) { return jsonError(error); }
}
