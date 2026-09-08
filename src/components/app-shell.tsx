"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BriefcaseBusiness, ClipboardCheck, LayoutGrid, LogOut, ShieldCheck, UserRound, Video } from "lucide-react";
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
    <aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark"><Video size={19}/></span><span>片场</span></Link><nav className="nav">{nav.map(([href,label,Icon])=><Link key={href} href={href} className={active(href)?"active":""}><Icon size={17}/>{label}</Link>)}</nav><div className="sidebar-foot"><div style={{fontWeight:700,color:"white"}}>{user.name}</div><div className="muted" style={{fontSize:12,marginTop:4}}>{roleName[user.role]}</div><button className="button secondary" style={{marginTop:14,width:"100%",background:"transparent",color:"#d5dbea",borderColor:"#344057"}} onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh();}}><LogOut size={15}/>退出登录</button></div></aside>
    <main className="main"><div className="mobile-nav">{nav.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</div><header className="topbar"><div><strong>AIGC 内容创作与交付</strong></div><span className="chip blue">{roleName[user.role]}</span></header>{children}</main>
  </div>;
}
