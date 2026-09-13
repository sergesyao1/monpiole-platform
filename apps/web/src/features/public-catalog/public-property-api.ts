import { ApiProblem, isProblemDetails } from "../../infrastructure/http/problem-details.js";
import type {
  PublicPropertyCatalogCriteria,
  PublicPropertyCatalogPage,
  PublicPropertyDetail,
} from "./public-property-model.js";

export interface PublicPropertyApi {
  list(criteria?: PublicPropertyCatalogCriteria): Promise<PublicPropertyCatalogPage>;
  retrieve(publicPropertyId: string): Promise<PublicPropertyDetail>;
  submitInquiry(publicPropertyId:string,input:PublicInquiryInput):Promise<{readonly inquiryId:string;readonly receivedAt:string}>;
  photoUrl(path: `/v1/public/properties/${string}/primary-photo` | `/v1/public/properties/${string}/media/${string}/content`): string;
}

export function createPublicPropertyApi(): PublicPropertyApi {
  return {
    list: (criteria = {}) => requestPublicJson<PublicPropertyCatalogPage>(catalogPath(criteria)),
    retrieve: (publicPropertyId) => requestPublicJson<PublicPropertyDetail>(
      `/v1/public/properties/${encodeURIComponent(publicPropertyId)}`,
    ),
    submitInquiry:(publicPropertyId,input)=>requestPublicJson(`/v1/public/properties/${encodeURIComponent(publicPropertyId)}/inquiries`,{method:"POST",body:input}),
    photoUrl: (path) => path,
  };
}

export type PublicInquiryIntent = "CONTACT" | "VIEWING_REQUEST";
export type PublicInquiryPreferredContactChannel = "PHONE" | "SMS" | "EMAIL";

export interface PublicInquiryInput {
  readonly contactName: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly message?: string;
  readonly intent: PublicInquiryIntent;
  readonly preferredContactChannel?: PublicInquiryPreferredContactChannel;
  readonly consent: true;
  readonly consentVersion: string;
  readonly idempotencyKey: string;
}
async function requestPublicJson<ResponseBody>(path: `/v1/${string}`,options?:Readonly<{method:"POST";body:unknown}>): Promise<ResponseBody> {
  const headers = new Headers({ accept: "application/json", "x-correlation-id": crypto.randomUUID() });
  if(options)headers.set("content-type","application/json");const response = await fetch(path, { headers,method:options?.method,body:options?JSON.stringify(options.body):undefined });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (isProblemDetails(payload)) throw new ApiProblem(payload);
    throw new Error("La rÃ©ponse du catalogue n'a pas pu Ãªtre traitÃ©e.");
  }
  if (payload === undefined) throw new Error("La rÃ©ponse du catalogue est vide.");
  return payload as ResponseBody;
}

function catalogPath(criteria: PublicPropertyCatalogCriteria): `/v1/${string}` {
  const query = new URLSearchParams({ limit: "20" });
  if (criteria.cursor !== undefined) query.set("cursor", criteria.cursor);
  if (criteria.type !== undefined) query.set("type", criteria.type);
  if (criteria.transactionType !== undefined) query.set("transactionType", criteria.transactionType);
  return `/v1/public/properties?${query.toString()}`;
}
