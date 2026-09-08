import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, UsersRound } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";

const statusText: Record<string,string>={OPEN:"报名中",SELECTING:"选人中",IN_PRODUCTION:"制作中",PENDING_ACCEPTANCE:"待验收",COMPLETED:"已完成"};
const modeText: Record<string,string>={MULTI_DELIVERY:"多人独立交付",CONTEST:"竞稿择优"};
export default async function Home({searchParams}:{searchParams:Promise<{q?:string;platform?:string;mode?:"CONTEST"|"MULTI_DELIVERY"}>}) {
  const user=await getSessionUser(); if(!user) redirect("/login");
  const filters=await searchParams;
  const orders=await prisma.order.findMany({where:{status:{in:["OPEN","SELECTING","IN_PRODUCTION","PENDING_ACCEPTANCE","COMPLETED"]},...(filters.platform?{platform:filters.platform}:{}),...(filters.mode?{mode:filters.mode}:{}),...(filters.q?{OR:[{title:{contains:filters.q,mode:"insensitive"}},{topic:{contains:filters.q,mode:"insensitive"}},{style:{contains:filters.q,mode:"insensitive"}}]}:{})},orderBy:[{publishedAt:"desc"},{updatedAt:"desc"}],take:30,include:{client:{select:{name:true,avatarColor:true}},_count:{select:{applications:true}}}});
  const open=orders.filter(o=>o.status==="OPEN").length, creators=await prisma.creatorProfile.count({where:{available:true}});
  return <AppShell user={user}><div className="content"><div className="row between wrap"><div><div className="eyebrow">ORDER HALL</div><h1>订单大厅</h1><p className="muted" style={{margin:0}}>查看清晰的制作要求，再决定是否投入创作。</p></div>{user.role!=="CREATOR"&&<Link className="button" href="/orders/new">发布新订单<ArrowRight size={16}/></Link>}</div>
  <div className="grid grid-3" style={{marginTop:24}}><div className="card"><div className="muted">正在报名的订单</div><div className="metric">{open}</div></div><div className="card"><div className="muted">可接单创作者</div><div className="metric">{creators}</div></div><div className="card"><div className="muted">平台成交原则</div><div style={{fontWeight:700,marginTop:12}}>无虚假销量 · 验收后确权</div></div></div>
  <form className="card row wrap" style={{marginTop:20}}><input className="input" style={{maxWidth:300}} name="q" defaultValue={filters.q} placeholder="搜索主题、标题或风格"/><select className="input" style={{maxWidth:160}} name="platform" defaultValue={filters.platform||""}><option value="">全部平台</option><option>抖音</option><option>小红书</option><option>视频号</option><option>B站</option></select><select className="input" style={{maxWidth:180}} name="mode" defaultValue={filters.mode||""}><option value="">全部模式</option><option value="MULTI_DELIVERY">多人独立交付</option><option value="CONTEST">竞稿择优</option></select><button className="button">筛选</button><Link className="button secondary" href="/">重置</Link></form>
  <div className="row between" style={{marginTop:30,marginBottom:14}}><h2>最新订单</h2><span className="muted" style={{fontSize:13}}>共 {orders.length} 条可见记录</span></div>
  {orders.length?<div className="grid grid-3">{orders.map(order=><Link href={`/orders/${order.id}`} className="card order-card" key={order.id}><div className="row between"><span className={`chip ${order.status==="OPEN"?"green":"blue"}`}>{statusText[order.status]}</span><span className="muted" style={{fontSize:12}}>{order.code}</span></div><div><h3>{order.title}</h3><div className="description" style={{marginTop:7}}>{order.objective}</div></div><div className="row wrap"><span className="chip">{order.platform}</span><span className="chip">{order.style}</span><span className="chip orange">{modeText[order.mode]}</span></div><div className="foot row between"><span className="row muted" style={{fontSize:13}}><UsersRound size={15}/>{order._count.applications} 人报名</span><span className="row muted" style={{fontSize:13}}><CalendarDays size={15}/>{order.deadline.toLocaleDateString("zh-CN",{timeZone:"Asia/Shanghai"})}</span></div></Link>)}</div>:<div className="card empty">暂无公开订单。审核通过的真实订单会显示在这里。</div>}
  </div></AppShell>;
}
