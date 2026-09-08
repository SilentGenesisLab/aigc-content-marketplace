import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reputation } from "@/lib/business";

export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const creator = await prisma.user.findFirst({
    where: { id, role: "CREATOR" },
    select: {
      name: true,
      avatarColor: true,
      creatorProfile: true,
      portfolios: { where: { isPublic: true }, orderBy: { createdAt: "desc" } },
      reviewsReceived: { select: { rating: true, comment: true, createdAt: true } },
      subOrders: {
        where: { status: "ACCEPTED" },
        select: {
          order: { select: { deadline: true } },
          deliveries: { where: { status: "FINAL" }, select: { createdAt: true }, take: 1 },
        },
      },
    },
  });
  if (!creator) notFound();
  const onTime = creator.subOrders.filter((item) => item.deliveries[0]?.createdAt <= item.order.deadline).length;
  const score = reputation(creator.subOrders.length, onTime, creator.reviewsReceived);
  return <AppShell user={user}><div className="content">
    <div className="row"><div className="avatar" style={{ background: creator.avatarColor }}>{creator.name.slice(0, 1)}</div><div><div className="eyebrow">CREATOR</div><h1>{creator.name}</h1></div></div>
    <p className="muted">{creator.creatorProfile?.bio || "该创作者尚未填写介绍"}</p>
    <div className="grid grid-3" style={{ marginTop: 20 }}><div className="card"><div className="muted">已完成</div><div className="metric">{score.completed}</div></div><div className="card"><div className="muted">准时率</div><div className="metric">{score.onTimeRate === null ? "暂无" : `${score.onTimeRate}%`}</div></div><div className="card"><div className="muted">客户评分</div><div className="metric">{score.averageRating ?? "暂无"}</div></div></div>
    <section className="card" style={{ marginTop: 20 }}><h2>能力与作品</h2><p>{creator.creatorProfile?.skills.join(" · ") || "暂无技能标签"}</p><div className="grid grid-3">{creator.portfolios.length ? creator.portfolios.map((work) => <a href={work.fileUrl} target="_blank" rel="noreferrer" className="card" key={work.id}><strong>{work.title}</strong><p className="muted">{work.description || "暂无说明"}</p></a>) : <div className="empty">暂无公开作品</div>}</div></section>
  </div></AppShell>;
}
