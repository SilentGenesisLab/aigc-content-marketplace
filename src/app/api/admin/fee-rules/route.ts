import { Prisma, UserRole } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, body, jsonError, required } from "@/lib/api";
import { prisma } from "@/lib/prisma";
export async function POST(request:Request){try{const user=await requireUser([UserRole.ADMIN]);const data=await body<{name?:string;ratePercent?:number}>(request);const percent=Number(data.ratePercent);if(!Number.isFinite(percent)||percent<0||percent>100)throw new ApiError("费率应在 0% 到 100% 之间");const rule=await prisma.$transaction(async tx=>{await tx.feeRule.updateMany({where:{active:true},data:{active:false}});return tx.feeRule.create({data:{name:required(data.name,"规则名称"),rate:new Prisma.Decimal(percent).div(100),active:true}})});await audit(user.id,"FEE_RULE_CHANGED","FeeRule",rule.id,{ratePercent:percent});return Response.json({rule},{status:201})}catch(error){return jsonError(error)}}
