import type { PropertyApplication, PropertyApplicationStatus } from "../domain/property-application.js";
import type { PropertyViewingOutcomeStatus } from "../domain/property-viewing-outcome.js";

export interface PropertyApplicationCursor { readonly createdAt: string; readonly applicationId: string; }
export interface PropertyApplicationListItem {
  readonly application: PropertyApplication;
  readonly candidate: { readonly contactName: string; readonly email?: string; readonly phoneNumber?: string };
  readonly viewing: { readonly startsAt: string; readonly endsAt: string; readonly timeZone: string; readonly completedAt?: string };
  readonly outcome: { readonly status: PropertyViewingOutcomeStatus; readonly note?: string; readonly decidedAt?: string };
}
export interface PropertyApplicationPage { readonly items: readonly PropertyApplicationListItem[]; readonly nextCursor?: PropertyApplicationCursor; }
export type CreateApplicationResult={readonly kind:"SAVED"|"EXISTING";readonly application:PropertyApplication}|{readonly kind:"OUTCOME_NOT_FOUND"|"OUTCOME_NOT_ELIGIBLE"};
export interface PropertyApplicationRepository{createForProceedOutcome(application:PropertyApplication,trace:{actorId:string;correlationId:string}):Promise<CreateApplicationResult>;findByViewing(tenantId:string,propertyId:string,viewingId:string):Promise<PropertyApplication|undefined>;find(tenantId:string,propertyId:string,applicationId:string):Promise<PropertyApplication|undefined>;list(tenantId:string,propertyId:string,limit:number,cursor?:PropertyApplicationCursor,status?:PropertyApplicationStatus):Promise<PropertyApplicationPage|undefined>;update(tenantId:string,propertyId:string,applicationId:string,change:(application:PropertyApplication)=>PropertyApplication,trace:{actorId:string;correlationId:string}):Promise<PropertyApplication|undefined>}
