"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BriefcaseBusiness, ChevronRight, ClipboardCheck, LayoutGrid, LogOut, Radio, ShieldCheck, UserRound, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type User = { id: string; name: string; role: "CLIENT" | "CREATOR" | "ADMIN" };
const roleName = { CLIENT: "发单者", CREATOR: "创作者", ADMIN: "平台管理员" };

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const nav: [string, string, LucideIcon][] = [
    ["/", "订单大厅", LayoutGrid],
    ["/orders/new", "发布订单", BriefcaseBusiness],
    ["/work", user.role === "CREATOR" ? "我的制作" : "我的订单", ClipboardCheck],
    ...(user.role === "CREATOR" ? [["/profile", "创作者档案", UserRound] as [string, string, LucideIcon]] : []),
    ...(user.role === "ADMIN" ? [["/admin", "平台管理", ShieldCheck] as [string, string, LucideIcon]] : []),
  ];
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <div className="shell">
    <a className="skip-link" href="#main-content">跳转到主要内容</a>
    <aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark"><Video size={19}/></span><span>片场<small>AIGC WORKSPACE</small></span></Link><div className="nav-label">工作空间</div><nav className="nav">{nav.map(([href,label,Icon])=><Link key={href} href={href} className={active(href)?"active":""}><Icon size={17}/><span>{label}</span>{active(href)&&<ChevronRight className="nav-arrow" size={15}/>}</Link>)}</nav><div className="sidebar-foot"><div className="user-row"><span className="user-avatar">{user.name.slice(0,1)}</span><span><strong>{user.name}</strong><small>{roleName[user.role]}</small></span></div><button className="sidebar-logout" aria-label="退出登录" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh();}}><LogOut size={16}/><span>退出登录</span></button></div></aside>
    <main className="main" id="main-content"><div className="mobile-nav">{nav.map(([href,label,Icon])=><Link className={active(href)?"active":""} key={href} href={href}><Icon size={16}/>{label}</Link>)}</div><header className="topbar"><div className="workspace-title"><span className="status-orb"><Radio size={14}/></span><span><strong>AIGC 内容创作与交付</strong><small>创作履约工作台</small></span></div><span className="role-badge">{roleName[user.role]}</span></header>{children}</main>
  </div>;
}
