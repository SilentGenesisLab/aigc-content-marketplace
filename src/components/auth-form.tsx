"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Video } from "lucide-react";
import { api } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter(); const search = useSearchParams(); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries());
    try { await api(`/api/auth/${mode}`, { method:"POST", body:JSON.stringify(payload) }); const next = search.get("next"); router.push(next?.startsWith("/")&&!next.startsWith("//")?next:"/"); router.refresh(); }
    catch (e) { setError(e instanceof Error?e.message:"操作失败"); } finally { setLoading(false); }
  }
  return <div className="auth-page"><section className="auth-art"><div className="row"><span className="brand-mark"><Video size={19}/></span><strong>片场</strong></div><h1>让每一次创作，都有清晰的 Brief 和可信的交付。</h1><p style={{color:"#aeb9ce",maxWidth:600}}>连接真实需求与真实创作者，从报名、中选、制作到验收，完整保留 AIGC 工具、素材授权和权利确认记录。</p></section><section className="auth-panel"><div className="auth-box"><div className="eyebrow">AIGC CONTENT WORKSPACE</div><h1>{mode==="login"?"登录片场":"创建账户"}</h1><p className="muted">{mode==="login"?"继续管理你的订单与交付":"选择真实身份，开始发布需求或参与创作"}</p>{error&&<div className="notice error">{error}</div>}<form className="form" onSubmit={submit} style={{marginTop:24}}>{mode==="register"&&<><div className="field"><label>姓名</label><input className="input" name="name" required placeholder="你的真实姓名"/></div><div className="field"><label>身份</label><select className="input" name="role"><option value="CLIENT">我是发单者</option><option value="CREATOR">我是创作者</option></select></div></>}<div className="field"><label>手机号</label><input className="input" name="phone" required inputMode="tel" pattern="1[0-9]{10}" placeholder="11 位手机号"/></div><div className="field"><label>密码</label><input className="input" name="password" required type="password" minLength={8} placeholder="至少 8 位"/></div><button disabled={loading} className="button" type="submit">{loading?"处理中…":mode==="login"?"登录":"注册并进入"}<ArrowRight size={16}/></button></form><p className="muted" style={{fontSize:14,marginTop:20}}>{mode==="login"?<>还没有账户？<Link href="/register" style={{color:"var(--blue)",fontWeight:700}}>立即注册</Link></>:<>已有账户？<Link href="/login" style={{color:"var(--blue)",fontWeight:700}}>返回登录</Link></>}</p></div></section></div>;
}
