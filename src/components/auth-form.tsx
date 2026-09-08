"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Video } from "lucide-react";
import { api } from "@/lib/client";

type LoginMethod = "password" | "sms";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const search = useSearchParams();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const nextPath = safeNext(search.get("next"));

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function sendCode(form: HTMLFormElement) {
    const phone = String(new FormData(form).get("phone") || "").trim();
    setError("");
    setNotice("");
    setSending(true);
    try {
      await api("/api/auth/sms/send", {
        method: "POST",
        body: JSON.stringify({ phone, purpose: mode === "register" ? "REGISTER" : "LOGIN" }),
      });
      setCountdown(60);
      setNotice("验证码已发送，5 分钟内有效");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "验证码发送失败");
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const endpoint = mode === "register" ? "/api/auth/register" : loginMethod === "sms" ? "/api/auth/sms/login" : "/api/auth/login";
    try {
      await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      router.push(nextPath);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  const switchHref = `${mode === "login" ? "/register" : "/login"}${nextPath === "/" ? "" : `?next=${encodeURIComponent(nextPath)}`}`;
  const needsSms = mode === "register" || loginMethod === "sms";

  return <div className="auth-page">
    <section className="auth-art">
      <div className="row"><span className="brand-mark"><Video size={19}/></span><strong>片场</strong></div>
      <h1>让每一次创作，都有清晰的 Brief 和可信的交付。</h1>
      <p style={{ color: "#aeb9ce", maxWidth: 600 }}>连接真实需求与真实创作者，从报名、中选、制作到验收，完整保留 AIGC 工具、素材授权和权利确认记录。</p>
    </section>
    <section className="auth-panel">
      <div className="auth-box">
        <div className="eyebrow">AIGC CONTENT WORKSPACE</div>
        <h1>{mode === "login" ? "登录片场" : "创建账户"}</h1>
        <p className="muted">{mode === "login" ? "继续管理你的订单与交付" : "验证手机号，开始发布需求或参与创作"}</p>
        {mode === "login" && <div className="auth-tabs" role="tablist" aria-label="登录方式">
          <button type="button" role="tab" aria-selected={loginMethod === "password"} className={loginMethod === "password" ? "active" : ""} onClick={() => { setLoginMethod("password"); setError(""); setNotice(""); }}>密码登录</button>
          <button type="button" role="tab" aria-selected={loginMethod === "sms"} className={loginMethod === "sms" ? "active" : ""} onClick={() => { setLoginMethod("sms"); setError(""); setNotice(""); }}>验证码登录</button>
        </div>}
        {error && <div className="notice error" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}
        <form className="form" onSubmit={submit} style={{ marginTop: 24 }}>
          {mode === "register" && <>
            <div className="field"><label htmlFor="name">姓名</label><input id="name" className="input" name="name" required autoComplete="name" placeholder="你的真实姓名"/></div>
            <div className="field"><label htmlFor="role">身份</label><select id="role" className="input" name="role"><option value="CLIENT">我是发单者</option><option value="CREATOR">我是创作者</option></select></div>
          </>}
          <div className="field"><label htmlFor="phone">手机号</label><input id="phone" className="input" name="phone" required inputMode="tel" autoComplete="tel" pattern="1[0-9]{10}" placeholder="11 位中国大陆手机号"/></div>
          {needsSms && <div className="field"><label htmlFor="smsCode">短信验证码</label><div className="sms-row"><input id="smsCode" className="input" name="smsCode" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6 位验证码"/><button className="button secondary" type="button" disabled={sending || countdown > 0} onClick={(event) => sendCode(event.currentTarget.form!)}>{countdown > 0 ? `${countdown} 秒` : sending ? "发送中…" : "获取验证码"}</button></div></div>}
          {(mode === "register" || loginMethod === "password") && <div className="field"><label htmlFor="password">密码</label><input id="password" className="input" name="password" required type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} placeholder="至少 8 位"/></div>}
          <button disabled={loading} className="button" type="submit">{loading ? "处理中…" : mode === "login" ? "登录" : "注册并进入"}<ArrowRight size={16}/></button>
        </form>
        <p className="muted" style={{ fontSize: 14, marginTop: 20 }}>{mode === "login" ? <>还没有账户？<Link href={switchHref} style={{ color: "var(--blue)", fontWeight: 700 }}>立即注册</Link></> : <>已有账户？<Link href={switchHref} style={{ color: "var(--blue)", fontWeight: 700 }}>返回登录</Link></>}</p>
      </div>
    </section>
  </div>;
}
