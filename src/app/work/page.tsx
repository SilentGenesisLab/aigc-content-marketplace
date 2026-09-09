import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WorkflowCard } from "@/components/workflow-card";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkPage(){
  const user=await getSessionUser();if(!user)redirect("/login");
  const teamOrder={OR:[{clientId:user.id},{clientOrganization:{members:{some:{userId:user.id}}}},{collaborators:{some:{userId:user.id}}}]};
  const where=user.role==="ADMIN"?{}:user.role==="CREATOR"?{creatorId:user.id}:{order:teamOrder};
  const rows=await prisma.subOrder.findMany({where,orderBy:{updatedAt:"desc"},include:{
    order:{select:{id:true,title:true,clientId:true,deadline:true,clientOrganization:{select:{members:{where:{userId:user.id},select:{role:true}}}},collaborators:{where:{userId:user.id},select:{role:true}}}},
    creator:{select:{name:true}},briefSnapshot:true,payment:true,
    deliveries:{orderBy:{version:"desc"},include:{compliance:true,revisions:true,comments:{orderBy:{timecodeMs:"asc"},include:{author:{select:{name:true}}}}}},rightsReceipt:true,reviews:true,
  }});
  const hydrated=rows.map(item=>{const roles=[...(item.order.clientOrganization?.members.map(member=>member.role)||[]),...item.order.collaborators.map(member=>member.role)];const owner=item.order.clientId===user.id||roles.includes("OWNER");return{...item,access:{manage:owner||roles.some(role=>["ADMIN","PROJECT_MANAGER"].includes(role)),review:owner||roles.some(role=>["ADMIN","REVIEWER"].includes(role)),finance:owner||roles.some(role=>["ADMIN","FINANCE"].includes(role))}}});
  const drafts=user.role!=="CREATOR"?await prisma.order.findMany({where:user.role==="ADMIN"?{status:"PENDING_REVIEW"}:{AND:[teamOrder,{status:{in:["DRAFT","PENDING_REVIEW","OPEN"]}}]},orderBy:{updatedAt:"desc"}}):[];
  return <AppShell user={user}><div className="content"><div className="eyebrow">WORKSPACE</div><h1>{user.role==="CREATOR"?"我的制作":"我的订单"}</h1><p className="muted">Brief 确认、沙箱托管、版本审阅、验收确权和结算均由真实操作推进。</p>{drafts.length>0&&<section style={{margin:"24px 0"}}><h2 style={{marginBottom:12}}>发单进度</h2><div className="grid grid-3">{drafts.map(order=><Link className="card" href={`/orders/${order.id}`} key={order.id}><strong>{order.title}</strong><p className="muted">{order.code}</p><span className="chip blue">{order.status}</span></Link>)}</div></section>}<section className="grid" style={{marginTop:24}}>{hydrated.length?JSON.parse(JSON.stringify(hydrated)).map((item:never)=><WorkflowCard key={(item as {id:string}).id} item={item} user={user}/>):<div className="card empty">目前还没有履约子订单。</div>}</section></div></AppShell>;
}
