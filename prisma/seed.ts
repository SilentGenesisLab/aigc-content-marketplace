import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("Demo@123456", 12);
  const users = [
    { phone: "13800000001", name: "林清", role: UserRole.CLIENT },
    { phone: "13800000002", name: "周屿", role: UserRole.CREATOR },
    { phone: "13800000003", name: "平台管理员", role: UserRole.ADMIN },
  ];
  for (const item of users) {
    const user = await prisma.user.upsert({ where: { phone: item.phone }, update: {}, create: { ...item, passwordHash } });
    if (item.role === UserRole.CREATOR) {
      await prisma.creatorProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, bio: "专注消费品牌短视频与数字人内容", skills: ["脚本", "分镜", "数字人"], platforms: ["抖音", "小红书"], styles: ["产品种草", "口播"] },
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
