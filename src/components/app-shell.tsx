"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BriefcaseBusiness, ChevronRight, ClipboardCheck, LayoutDashboard, LayoutGrid, LogOut, MessageSquare, Radio, ShieldCheck, UserRound, UsersRound, Video, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Role = "CLIENT" | "CREATOR" | "ADMIN";
type User = { id: string; name: string; role: Role; roles: Role[] };
const roleName: Record<Role,string> = { CLIENT: "发布者", CREATOR: "视频制作者", ADMIN: "平台管理员" };

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching,setSwitching]=useState(false);
  const switchableRoles:Role[]=user.roles.includes("ADMIN")?user.roles:["CLIENT","CREATOR"];
  const nav: [string, string, LucideIcon][] = [
    ["/dashboard", "工作台", LayoutDashboard],
    ["/", "订单大厅", LayoutGrid],
    ...(user.role === "CLIENT" ? [["/orders/new", "发布订单", BriefcaseBusiness] as [string, string, LucideIcon]] : []),
    ["/work", user.role === "CREATOR" ? "我的制作" : "我的订单", ClipboardCheck],
    ...(user.role === "CREATOR" ? [["/profile", "创作者档案", UserRound] as [string, string, LucideIcon]] : []),
    ...(user.role !== "ADMIN" ? [
      ["/organizations", "团队协作", UsersRound] as [string, string, LucideIcon],
      ["/finance", "资金中心", WalletCards] as [string, string, LucideIcon],
      ["/messages", "消息通知", MessageSquare] as [string, string, LucideIcon],
    ] : []),
    ...(user.role === "ADMIN" ? [["/admin", "平台管理", ShieldCheck] as [string, string, LucideIcon]] : []),
  ];
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function switchRole(role: Role) {
    setSwitching(true);
    try {
      const response=await fetch("/api/auth/roles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({role})});
      if(response.ok){router.push("/dashboard");router.refresh();}
    } finally { setSwitching(false); }
  }

  return <div className="shell">
    <a className="skip-link" href="#main-content">跳转到主要内容</a>
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><span className="brand-mark"><Video size={19}/></span><span>片场<small>AIGC WORKSPACE</small></span></Link>
      <div className="nav-label">{roleName[user.role]}工作空间</div>
      <nav className="nav">{nav.map(([href,label,Icon])=><Link key={href} href={href} className={active(href)?"active":""}><Icon size={17}/><span>{label}</span>{active(href)&&<ChevronRight className="nav-arrow" size={15}/>}</Link>)}</nav>
      <div className="sidebar-foot"><div className="user-row"><span className="user-avatar">{user.name.slice(0,1)}</span><span><strong>{user.name}</strong><small>{roleName[user.role]}</small></span></div><button className="sidebar-logout" aria-label="退出登录" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh();}}><LogOut size={16}/><span>退出登录</span></button></div>
    </aside>
    <main className="main" id="main-content">
      <div className="mobile-nav">{nav.map(([href,label,Icon])=><Link className={active(href)?"active":""} key={href} href={href}><Icon size={16}/>{label}</Link>)}</div>
      <header className="topbar"><div className="workspace-title"><span className="status-orb"><Radio size={14}/></span><span><strong>AIGC 内容创作与交付</strong><small>真实需求 · 可信交付 · 验收确权</small></span></div><div className="role-switch"><label className="sr-only" htmlFor="active-role">当前身份</label><select id="active-role" disabled={switching} value={user.role} onChange={event=>switchRole(event.target.value as Role)}>{switchableRoles.map(role=><option key={role} value={role}>{user.roles.includes(role)?roleName[role]:`开通${roleName[role]}身份`}</option>)}</select><span className="role-badge">{switching?"切换中…":roleName[user.role]}</span></div></header>
      {children}
    </main>
  </div>;
}
