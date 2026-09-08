import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApplyForm, ApplicantSelector, OrderAction } from "@/components/order-actions";

const status: Record<string, string> = { DRAFT: "草稿", PENDING_REVIEW: "待审核", OPEN: "报名中", SELECTING: "选人中", IN_PRODUCTION: "制作中", PENDING_ACCEPTANCE: "待验收", COMPLETED: "已完成", CANCELLED: "已取消", DISPUTED: "争议中" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      applications: {
        include: {
          creator: {
            select: {
              name: true,
              creatorProfile: true,
              portfolios: { where: { isPublic: true } },
              reviewsReceived: { select: { rating: true } },
              _count: { select: { subOrders: { where: { status: "ACCEPTED" } } } },
            },
          },
        },
      },
      subOrders: { include: { creator: { select: { name: true } } } },
    },
  });
  if (!order) notFound();
  const mine = order.applications.some((item) => item.creatorId === user.id);
  const activeApplications = order.applications.filter((item) => !["REJECTED", "WITHDRAWN"].includes(item.status));
  return <AppShell user={user}>
    <div className="content">
      <div className="row between wrap"><div><div className="eyebrow">{order.code}</div><h1>{order.title}</h1><div className="row wrap"><span className="chip blue">{status[order.status]}</span><span className="chip">{order.mode === "CONTEST" ? "竞稿择优" : "多人独立交付"}</span><span className="muted">发单者：{order.client.name}</span></div></div><div className="row">{order.clientId === user.id && order.status === "DRAFT" && <OrderAction id={order.id} action="submit" label="提交平台审核"/>}{user.role === "ADMIN" && order.status === "PENDING_REVIEW" && <><OrderAction id={order.id} action="approve" label="审核通过并发布"/><OrderAction id={order.id} action="reject" label="退回补充" danger/></>}</div></div>
      <div className="detail-grid" style={{ marginTop: 24 }}>
        <div className="grid">
          <section className="card"><h2>最终 Brief</h2><div className="divider"/><div className="grid grid-2"><div><div className="muted">营销目标</div><p>{order.objective}</p></div><div><div className="muted">内容主题</div><p>{order.topic}</p></div><div><div className="muted">目标受众</div><p>{order.audience}</p></div><div><div className="muted">风格与平台</div><p>{order.style} · {order.platform} · {order.aspectRatio}</p></div></div><div><div className="muted">验收标准</div><p style={{ whiteSpace: "pre-wrap" }}>{order.acceptanceCriteria}</p></div>{order.forbiddenElements && <div><div className="muted">禁用元素</div><p>{order.forbiddenElements}</p></div>}</section>
          {order.clientId === user.id && order.applications.length > 0 && ["OPEN", "SELECTING"].includes(order.status) && <section className="card"><h2>报名者对比与中选</h2><p className="muted">仅展示真实作品和履约数据。最多中选 {order.mode === "CONTEST" ? 1 : order.slots} 人。</p>{order.applications.map((application) => <div key={application.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}><div className="row between"><Link href={`/creators/${application.creatorId}`} style={{color:"var(--blue)"}}><strong>{application.creator.name}</strong></Link><span className="chip">已完成 {application.creator._count.subOrders} 单</span></div><p>{application.pitch}</p><p className="muted">{application.creator.creatorProfile?.bio||"创作者尚未填写介绍"}</p><div className="muted" style={{ fontSize: 13 }}>{application.creator.creatorProfile?.skills.join(" · ") || "尚未完善技能"} · {application.creator.reviewsReceived.length ? `${(application.creator.reviewsReceived.reduce((sum, review) => sum + review.rating, 0) / application.creator.reviewsReceived.length).toFixed(1)} 分` : "暂无评价"}</div>{application.creator.portfolios.length?<div className="row wrap" style={{marginTop:10}}>{application.creator.portfolios.map(work=><a className="chip blue" href={work.fileUrl} target="_blank" rel="noreferrer" key={work.id}>{work.title}</a>)}</div>:<div className="muted" style={{fontSize:13,marginTop:8}}>暂无公开作品</div>}</div>)}<div style={{ marginTop: 16 }}><ApplicantSelector orderId={order.id} max={order.mode === "CONTEST" ? 1 : order.slots} applications={activeApplications.map((item) => ({ id: item.id, name: item.creator.name }))}/></div></section>}
          {order.subOrders.length > 0 && <section className="card"><h2>履约子订单</h2><div className="divider"/>{order.subOrders.map((subOrder) => <Link href="/work" className="row between" key={subOrder.id} style={{ padding: "10px 0" }}><span><strong>{subOrder.code}</strong> · {subOrder.creator.name}</span><span className="chip blue">{subOrder.status}</span></Link>)}</section>}
        </div>
        <aside className="grid" style={{ alignContent: "start" }}><div className="card"><h2>交付约束</h2><div className="divider"/><p><strong>{order.quantity}</strong> 条，单条 {order.duration}</p><p>截止：{order.deadline.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p><p>名额：{order.slots} · 已报名 {order.applications.length}</p><p>{order.sampleRequired ? "报名需要样稿" : "报名无需样稿"}</p></div>{user.role === "CREATOR" && order.status === "OPEN" && !mine && <div className="card"><h2>参与创作</h2><p className="muted">确认你理解订单模式和交付约束后再报名。</p><ApplyForm orderId={order.id}/></div>}{mine && <div className="notice">你已报名该订单，可在“我的制作”跟踪中选结果。</div>}</aside>
      </div>
    </div>
  </AppShell>;
}
