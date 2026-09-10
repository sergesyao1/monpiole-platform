import type { PropertyContractView } from "./manage-property-contracts.js";
import { toPropertyContractView } from "./manage-property-contracts.js";
import type { ApplicationContractTerms, PropertyApplicationContractRepository } from "./property-application-contract-repository.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";

export class PropertyApplicationContractNotFoundError extends Error { readonly code="PROPERTY_APPLICATION_CONTRACT_NOT_FOUND"; }
export class PropertyApplicationNotConvertedError extends Error { readonly code="PROPERTY_APPLICATION_NOT_CONVERTED"; }
export class PropertyApplicationContractNotEligibleError extends Error { readonly code="PROPERTY_APPLICATION_CONTRACT_NOT_ELIGIBLE"; }
export class PropertyApplicationContractReplayConflictError extends Error { readonly code="PROPERTY_APPLICATION_CONTRACT_REPLAY_CONFLICT"; }

export class CreatePropertyContractFromApplication {
  constructor(private readonly repository:PropertyApplicationContractRepository,private readonly ids:{generate():string},private readonly clock:{now():string}){}
  async execute(command:Readonly<ApplicationContractTerms & {authority:PropertyAuthority;propertyId:string;applicationId:string;correlationId:string}>):Promise<PropertyContractView>{
    const result=await this.repository.create({tenantId:authorizedTenant(command.authority,"CREATE_PROPERTY_CONTRACT_FROM_APPLICATION"),propertyId:command.propertyId,applicationId:command.applicationId,contractId:this.ids.generate(),createdAt:this.clock.now(),reference:command.reference,...(command.startDate===undefined?{}:{startDate:command.startDate}),...(command.endDate===undefined?{}:{endDate:command.endDate}),...(command.notes===undefined?{}:{notes:command.notes}),actorId:command.authority.actorId,correlationId:command.correlationId});
    if(result.kind==="NOT_FOUND")throw new PropertyApplicationContractNotFoundError();
    if(result.kind==="NOT_CONVERTED")throw new PropertyApplicationNotConvertedError();
    if(result.kind==="NOT_ELIGIBLE")throw new PropertyApplicationContractNotEligibleError();
    if(result.kind==="INCOMPATIBLE_REPLAY")throw new PropertyApplicationContractReplayConflictError();
    if(!("record"in result))throw new PropertyApplicationContractNotFoundError();
    return toPropertyContractView(result.record,command.authority);
  }
}
