import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function orderPermission(orderId:string,userId:string){
  const order=await prisma.order.findUnique({where:{id:orderId},select:{clientId:true,clientOrganization:{select:{members:{where:{userId},select:{role:true}}}},collaborators:{where:{userId},select:{role:true}}}});
  if(!order)return null;
  const roles=[...(order.clientOrganization?.members.map(item=>item.role)||[]),...order.collaborators.map(item=>item.role)];
  const owner=order.clientId===userId||roles.includes(OrganizationRole.OWNER);
  const manageRoles:OrganizationRole[]=[OrganizationRole.ADMIN,OrganizationRole.PROJECT_MANAGER];
  const reviewRoles:OrganizationRole[]=[OrganizationRole.ADMIN,OrganizationRole.REVIEWER];
  const financeRoles:OrganizationRole[]=[OrganizationRole.ADMIN,OrganizationRole.FINANCE];
  return {owner,view:owner||roles.length>0,manage:owner||roles.some(role=>manageRoles.includes(role)),review:owner||roles.some(role=>reviewRoles.includes(role)),finance:owner||roles.some(role=>financeRoles.includes(role))};
}
