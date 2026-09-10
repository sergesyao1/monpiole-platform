import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import type { PropertyApplicationContractRepository } from "../../../application/property-application-contract-repository.js";
import { PropertyContract } from "../../../domain/property-contract.js";
import { toClient } from "./postgres-property-client-repository.js";
import { properties, propertyApplicationClientConversions, propertyApplicationContractOrigins, propertyApplications, propertyClients, propertyContracts } from "./schema.js";

export class PostgresPropertyApplicationContractRepository implements PropertyApplicationContractRepository {
  constructor(private readonly pool:Pool){}
  create(input:Parameters<PropertyApplicationContractRepository["create"]>[0]){
    return withTenantPostgresTransaction(this.pool,input.tenantId,async scope=>{
      const db=scope.database();
      const application=(await db.select({application:propertyApplications,property:properties}).from(propertyApplications).innerJoin(properties,and(eq(properties.tenantId,propertyApplications.tenantId),eq(properties.propertyId,propertyApplications.propertyId))).where(and(eq(propertyApplications.tenantId,input.tenantId),eq(propertyApplications.propertyId,input.propertyId),eq(propertyApplications.applicationId,input.applicationId))).limit(1).for("update"))[0];
      if(!application)return{kind:"NOT_FOUND"as const};
      if(application.application.status!=="APPROVED")return{kind:"NOT_ELIGIBLE"as const};
      const source=(await db.select({conversion:propertyApplicationClientConversions,client:propertyClients}).from(propertyApplicationClientConversions).innerJoin(propertyClients,and(eq(propertyClients.tenantId,propertyApplicationClientConversions.tenantId),eq(propertyClients.clientId,propertyApplicationClientConversions.clientId))).where(and(eq(propertyApplicationClientConversions.tenantId,input.tenantId),eq(propertyApplicationClientConversions.applicationId,input.applicationId))).limit(1))[0];
      if(!source)return{kind:"NOT_CONVERTED"as const};
      if(application.property.transactionType!=="LONG_TERM_RENTAL"||application.property.structuralRole==="COMPOSITE")return{kind:"NOT_ELIGIBLE"as const};
      const existing=(await db.select({contract:propertyContracts}).from(propertyApplicationContractOrigins).innerJoin(propertyContracts,and(eq(propertyContracts.tenantId,propertyApplicationContractOrigins.tenantId),eq(propertyContracts.contractId,propertyApplicationContractOrigins.contractId))).where(and(eq(propertyApplicationContractOrigins.tenantId,input.tenantId),eq(propertyApplicationContractOrigins.applicationId,input.applicationId))).limit(1))[0];
      if(existing){const contract=fromContract(existing.contract);return sameTerms(contract,input)?{kind:"EXISTING"as const,record:{contract,client:toClient(source.client)}}:{kind:"INCOMPATIBLE_REPLAY"as const};}
      const contract=PropertyContract.create({contractId:input.contractId,tenantId:input.tenantId,propertyId:input.propertyId,clientId:source.client.clientId,contractType:"LEASE",reference:input.reference,...(input.startDate===undefined?{}:{startDate:input.startDate}),...(input.endDate===undefined?{}:{endDate:input.endDate}),...(input.notes===undefined?{}:{notes:input.notes}),createdAt:input.createdAt,updatedAt:input.createdAt},{structuralRole:application.property.structuralRole as "STANDALONE"|"COMPOSITE"|"UNIT",transactionType:application.property.transactionType as "LONG_TERM_RENTAL"});
      await db.insert(propertyContracts).values({...contract.values,startDate:contract.values.startDate??null,endDate:contract.values.endDate??null,notes:contract.values.notes??null,correlationId:input.correlationId,actorId:input.actorId});
      await db.insert(propertyApplicationContractOrigins).values({tenantId:input.tenantId,applicationId:input.applicationId,contractId:input.contractId,createdAt:input.createdAt,correlationId:input.correlationId,actorId:input.actorId});
      return{kind:"CREATED"as const,record:{contract,client:toClient(source.client)}};
    });
  }
}
type ContractRow=typeof propertyContracts.$inferSelect;
function fromContract(row:ContractRow){return PropertyContract.rehydrate({contractId:row.contractId,tenantId:row.tenantId,propertyId:row.propertyId,clientId:row.clientId,contractType:row.contractType as "LEASE"|"MANAGEMENT"|"OTHER",status:row.status as "DRAFT"|"ACTIVE"|"ENDED"|"CANCELLED",reference:row.reference,...(row.startDate?{startDate:row.startDate}:{}),...(row.endDate?{endDate:row.endDate}:{}),...(row.notes?{notes:row.notes}:{}),createdAt:new Date(row.createdAt).toISOString(),updatedAt:new Date(row.updatedAt).toISOString(),...(row.activatedAt?{activatedAt:new Date(row.activatedAt).toISOString()}:{}),...(row.endedAt?{endedAt:new Date(row.endedAt).toISOString()}:{}),...(row.cancelledAt?{cancelledAt:new Date(row.cancelledAt).toISOString()}:{})});}
function sameTerms(contract:PropertyContract,input:Parameters<PropertyApplicationContractRepository["create"]>[0]){const v=contract.values;return v.reference===input.reference.trim().toUpperCase()&&v.startDate===input.startDate&&v.endDate===input.endDate&&v.notes===input.notes?.trim();}
