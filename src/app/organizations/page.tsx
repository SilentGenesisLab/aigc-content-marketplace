import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrganizationPanel } from "@/components/organization-panel";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function OrganizationsPage(){const user=await getSessionUser();if(!user)redirect("/login");if(user.role==="ADMIN")redirect("/admin");const type=user.role==="CREATOR"?"CREATOR":"CLIENT";const memberships=await prisma.organizationMember.findMany({where:{userId:user.id,organization:{type}},include:{organization:{include:{_count:{select:{members:true,clientOrders:true}}}}},orderBy:{updatedAt:"desc"}});return <AppShell user={user}><div className="content"><div className="row between wrap"><div><div className="eyebrow">TEAM WORKSPACE</div><h1>团队协作</h1><p className="muted">发布方和制作方分别管理成员、职责和业务归属。</p></div><OrganizationPanel type={type}/></div><div className="grid grid-3" style={{marginTop:22}}>{memberships.map(item=><Link className="card" href={`/organizations/${item.organization.id}`} key={item.id}><div className="row between"><strong>{item.organization.name}</strong><span className="chip blue">{item.role}</span></div><p className="muted">{item.organization.description||"暂无团队说明"}</p><div className="row wrap"><span className="chip">{item.organization._count.members} 位成员</span>{type==="CLIENT"&&<span className="chip">{item.organization._count.clientOrders} 个订单</span>}</div></Link>)}</div></div></AppShell>}
