import { CommentStatus } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { orderPermission } from "@/lib/permissions";

async function deliveryForUser(id:string,userId:string,isAdmin:boolean){
  const delivery=await prisma.deliveryVersion.findUnique({where:{id},include:{subOrder:{include:{order:true}}}});
  if(!delivery) throw new ApiError("交付版本不存在",404);
  const permission=await orderPermission(delivery.subOrder.orderId,userId);
  if(!isAdmin&&delivery.subOrder.creatorId!==userId&&!permission?.review) throw new ApiError("没有审阅该版本的权限",403);
  return delivery;
}

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{const user=await requireUser();const{id}=await context.params;const delivery=await deliveryForUser(id,user.id,user.role==="ADMIN");const data=await body<{timecodeSeconds?:number;body?:string}>(request);const seconds=Number(data.timecodeSeconds);if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new ApiError("请输入有效的视频时间点");const comment=await prisma.timecodeComment.create({data:{deliveryId:id,authorId:user.id,timecodeMs:Math.round(seconds*1000),body:required(data.body,"批注内容")}});await audit(user.id,"TIMECODE_COMMENT_CREATED","DeliveryVersion",id,{commentId:comment.id,timecodeMs:comment.timecodeMs,subOrderId:delivery.subOrderId});return Response.json({comment},{status:201});}catch(error){return jsonError(error);}
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  try{const user=await requireUser();const{id}=await context.params;await deliveryForUser(id,user.id,user.role==="ADMIN");const data=await body<{commentId?:string;resolved?:boolean}>(request);const comment=await prisma.timecodeComment.findFirst({where:{id:data.commentId,deliveryId:id}});if(!comment)throw new ApiError("批注不存在",404);const updated=await prisma.timecodeComment.update({where:{id:comment.id},data:{status:data.resolved===false?CommentStatus.OPEN:CommentStatus.RESOLVED,resolvedAt:data.resolved===false?null:new Date()}});await audit(user.id,"TIMECODE_COMMENT_UPDATED","TimecodeComment",comment.id,{status:updated.status});return Response.json({comment:updated});}catch(error){return jsonError(error);}
}
