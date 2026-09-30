import { ApiProblem, isProblemDetails } from "../../infrastructure/http/problem-details.js";
import type {
  PublicPropertyCatalogCriteria,
  PublicPropertyCatalogPage,
  PublicPropertyDetail,
  PublicCountryReference,
  PublicCurrencyReference,
} from "./public-property-model.js";
import { serializePublicCatalogQuery } from "./public-catalog-search.js";

export interface PublicPropertyApi {
  list(criteria?: PublicPropertyCatalogCriteria): Promise<PublicPropertyCatalogPage>;
  retrieve(publicPropertyId: string): Promise<PublicPropertyDetail>;
  listCountries(): Promise<readonly PublicCountryReference[]>;
  listCurrencies(): Promise<readonly PublicCurrencyReference[]>;
  submitInquiry(publicPropertyId:string,input:PublicInquiryInput):Promise<{readonly inquiryId:string;readonly receivedAt:string}>;
  photoUrl(path: `/v1/public/properties/${string}/primary-photo` | `/v1/public/properties/${string}/media/${string}/content`): string;
}

export function createPublicPropertyApi(): PublicPropertyApi {
  return {
    list: (criteria = {}) => requestPublicJson<PublicPropertyCatalogPage>(catalogPath(criteria)),
    retrieve: (publicPropertyId) => requestPublicJson<PublicPropertyDetail>(
      `/v1/public/properties/${encodeURIComponent(publicPropertyId)}`,
    ),
    listCountries: async () => (await requestPublicJson<{ readonly items: readonly PublicCountryReference[] }>(
      "/v1/reference/countries",
    )).items.filter((country) => country.active && /^[A-Z]{2}$/u.test(country.code)),
    listCurrencies: async () => (await requestPublicJson<{ readonly items: readonly PublicCurrencyReference[] }>(
      "/v1/reference/currencies",
    )).items.filter((currency) => currency.active && /^[A-Z]{3}$/u.test(currency.code)
      && Number.isInteger(currency.minorUnit) && currency.minorUnit >= 0 && currency.minorUnit <= 9),
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
  const query = serializePublicCatalogQuery(criteria);
  return `/v1/public/properties?${query.toString()}`;
}
