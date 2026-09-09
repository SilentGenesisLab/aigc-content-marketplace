import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) throw new Error("DEMO_PASSWORD must contain at least 12 characters");
  const passwordHash = await hash(demoPassword, 12);
  const users = [
    { phone: "13800000001", name: "林清", role: UserRole.CLIENT },
    { phone: "13800000002", name: "周屿", role: UserRole.CREATOR },
    { phone: "13800000003", name: "平台管理员", role: UserRole.ADMIN },
  ];
  for (const item of users) {
    const user = await prisma.user.upsert({ where: { phone: item.phone }, update: { passwordHash }, create: { ...item, passwordHash } });
    await prisma.userRoleAssignment.upsert({ where: { userId_role: { userId: user.id, role: item.role } }, update: {}, create: { userId: user.id, role: item.role } });
    if (item.role !== UserRole.ADMIN) {
      const type = item.role === UserRole.CREATOR ? "CREATOR" : "CLIENT";
      const existing = await prisma.organization.findFirst({ where: { creatorId: user.id, type } });
      if (!existing) await prisma.organization.create({ data: { name: `${user.name}的工作空间`, type, creatorId: user.id, members: { create: { userId: user.id, role: "OWNER" } } } });
    }
    if (item.role === UserRole.CREATOR) {
      await prisma.creatorProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, bio: "专注消费品牌短视频与数字人内容", skills: ["脚本", "分镜", "数字人"], platforms: ["抖音", "小红书"], styles: ["产品种草", "口播"] },
      });
    }
  }
  if (!await prisma.feeRule.findFirst({ where: { active: true } })) await prisma.feeRule.create({ data: { name: "平台标准服务费", rate: "0.02" } });
}

main().finally(() => prisma.$disconnect());
