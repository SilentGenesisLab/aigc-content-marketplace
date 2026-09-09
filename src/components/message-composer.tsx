"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
export function MessageComposer({conversationId}:{conversationId:string}){const router=useRouter();const[busy,setBusy]=useState(false);async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);const form=new FormData(event.currentTarget);try{await api(`/api/conversations/${conversationId}/messages`,{method:"POST",body:JSON.stringify({body:form.get("body")})});event.currentTarget.reset();router.refresh()}finally{setBusy(false)}}return <form className="review-form" onSubmit={submit}><input className="input" name="body" required maxLength={2000} placeholder="发送与订单履约相关的消息"/><button className="button" disabled={busy}>{busy?"发送中…":"发送"}</button></form>}
