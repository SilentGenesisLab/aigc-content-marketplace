import { LedgerEntryType, PaymentStatus, SubOrderStatus } from "@prisma/client";
import { ApiError, requireUser } from "@/lib/auth";
import { audit, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { orderPermission } from "@/lib/permissions";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user=await requireUser();
    const {id}=await context.params;
    const item=await prisma.subOrder.findUnique({where:{id},include:{order:true,payment:true}});
    if(!item) throw new ApiError("子订单不存在",404);
    const permission=await orderPermission(item.orderId,user.id);
    if(!permission?.finance) throw new ApiError("只有订单负责人或财务成员可以完成托管",403);
    if(item.status!==SubOrderStatus.PENDING_CONFIRMATION||!item.creatorConfirmedAt) throw new ApiError("创作者确认 Brief 后才能托管");
    if(item.payment?.status===PaymentStatus.FUNDED) return Response.json({payment:item.payment});
    if(!item.grossAmount||!item.platformFee||!item.creatorNetAmount) throw new ApiError("订单金额快照不完整");
    const payment=await prisma.$transaction(async tx=>{
      const created=await tx.paymentIntent.upsert({where:{subOrderId:id},update:{status:PaymentStatus.FUNDED,fundedAt:new Date()},create:{subOrderId:id,provider:"SANDBOX",providerRef:`sandbox_${id}`,status:PaymentStatus.FUNDED,grossAmount:item.grossAmount!,platformFee:item.platformFee!,creatorNetAmount:item.creatorNetAmount!,fundedAt:new Date()}});
      const existing=await tx.ledgerEntry.count({where:{paymentIntentId:created.id,type:LedgerEntryType.FUND}});
      if(!existing) await tx.ledgerEntry.createMany({data:[{paymentIntentId:created.id,type:LedgerEntryType.FUND,amount:item.grossAmount!,note:"发布者沙箱托管入账"},{paymentIntentId:created.id,type:LedgerEntryType.HOLD,amount:item.grossAmount!,note:"履约资金冻结"}]});
      await tx.subOrder.update({where:{id},data:{status:SubOrderStatus.IN_PRODUCTION}});
      return created;
    });
    await audit(user.id,"SANDBOX_ESCROW_FUNDED","PaymentIntent",payment.id,{subOrderId:id});
    return Response.json({payment});
  }catch(error){return jsonError(error);}
}
