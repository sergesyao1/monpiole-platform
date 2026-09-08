import { ApiProblem, isProblemDetails } from "../../infrastructure/http/problem-details.js";
import type {
  PublicPropertyCatalogCriteria,
  PublicPropertyCatalogPage,
  PublicPropertyDetail,
} from "./public-property-model.js";

export interface PublicPropertyApi {
  list(criteria?: PublicPropertyCatalogCriteria): Promise<PublicPropertyCatalogPage>;
  retrieve(publicPropertyId: string): Promise<PublicPropertyDetail>;
  photoUrl(path: `/v1/public/properties/${string}/primary-photo` | `/v1/public/properties/${string}/media/${string}/content`): string;
}

export function createPublicPropertyApi(): PublicPropertyApi {
  return {
    list: (criteria = {}) => requestPublicJson<PublicPropertyCatalogPage>(catalogPath(criteria)),
    retrieve: (publicPropertyId) => requestPublicJson<PublicPropertyDetail>(
      `/v1/public/properties/${encodeURIComponent(publicPropertyId)}`,
    ),
    photoUrl: (path) => path,
  };
}

async function requestPublicJson<ResponseBody>(path: `/v1/${string}`): Promise<ResponseBody> {
  const headers = new Headers({ accept: "application/json", "x-correlation-id": crypto.randomUUID() });
  const response = await fetch(path, { headers });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (isProblemDetails(payload)) throw new ApiProblem(payload);
    throw new Error("La réponse du catalogue n'a pas pu être traitée.");
  }
  if (payload === undefined) throw new Error("La réponse du catalogue est vide.");
  return payload as ResponseBody;
}

function catalogPath(criteria: PublicPropertyCatalogCriteria): `/v1/${string}` {
  const query = new URLSearchParams({ limit: "20" });
  if (criteria.cursor !== undefined) query.set("cursor", criteria.cursor);
  if (criteria.type !== undefined) query.set("type", criteria.type);
  if (criteria.transactionType !== undefined) query.set("transactionType", criteria.transactionType);
  return `/v1/public/properties?${query.toString()}`;
}
