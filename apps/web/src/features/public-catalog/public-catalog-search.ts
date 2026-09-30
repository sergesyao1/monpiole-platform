import {
  publicPropertyTypes,
  type PropertyStructuralRole,
  type PublicCatalogSearchQuery,
  type PublicCatalogSort,
  type PublicPropertyCatalogCriteria,
  type PropertyType,
  type TransactionType,
} from "./public-property-model.js";

const TRANSACTION_TYPES = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] as const;
const STRUCTURAL_ROLES = ["STANDALONE", "COMPOSITE", "UNIT"] as const;
const SORTS = ["NEWEST", "PRICE_ASC", "PRICE_DESC"] as const;
const COUNTRY = /^[A-Z]{2}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export const DEFAULT_PUBLIC_CATALOG_LIMIT = 20;
export const DEFAULT_PUBLIC_CATALOG_SORT: PublicCatalogSort = "NEWEST";

export function parsePublicCatalogSearchParams(params: URLSearchParams): PublicCatalogSearchQuery {
  const propertyTypes = parseList(params, "type", publicPropertyTypes);
  const transactionTypes = parseList(params, "transactionType", TRANSACTION_TYPES);
  const structuralRoles = parseList(params, "structuralRole", STRUCTURAL_ROLES);
  const countryCode = canonicalCode(params.get("countryCode"), COUNTRY);
  const currencyCode = canonicalCode(params.get("currencyCode"), CURRENCY);
  const availableFrom = instant(params.get("availableFrom"));
  const availableTo = instant(params.get("availableTo"));
  const validInterval = availableFrom !== undefined && availableTo !== undefined
    && Date.parse(availableFrom) < Date.parse(availableTo);
  const sort = oneOf(params.get("sort"), SORTS);
  return compact({
    propertyTypes,
    transactionTypes,
    structuralRoles,
    countryCode,
    city: text(params.get("city")),
    commune: text(params.get("commune")),
    quartier: text(params.get("quartier")),
    minPriceAmountMinor: integer(params.get("minPriceAmountMinor"), Number.MAX_SAFE_INTEGER),
    maxPriceAmountMinor: integer(params.get("maxPriceAmountMinor"), Number.MAX_SAFE_INTEGER),
    currencyCode,
    minBedrooms: integer(params.get("minBedrooms"), 100),
    maxBedrooms: integer(params.get("maxBedrooms"), 100),
    availableFrom: validInterval ? availableFrom : undefined,
    availableTo: validInterval ? availableTo : undefined,
    q: text(params.get("q")),
    sort: sort === undefined || sort === DEFAULT_PUBLIC_CATALOG_SORT ? undefined : sort,
    limit: integer(params.get("limit"), 50, 1),
  });
}

export function serializePublicCatalogQuery(criteria: PublicPropertyCatalogCriteria): URLSearchParams {
  const query = new URLSearchParams();
  query.set("limit", String(criteria.limit ?? DEFAULT_PUBLIC_CATALOG_LIMIT));
  setList(query, "type", criteria.propertyTypes ?? (criteria.type === undefined ? undefined : [criteria.type]));
  setList(query, "transactionType", criteria.transactionTypes
    ?? (criteria.transactionType === undefined ? undefined : [criteria.transactionType]));
  setList(query, "structuralRole", criteria.structuralRoles);
  setText(query, "countryCode", criteria.countryCode);
  setText(query, "city", criteria.city);
  setText(query, "commune", criteria.commune);
  setText(query, "quartier", criteria.quartier);
  setNumber(query, "minPriceAmountMinor", criteria.minPriceAmountMinor);
  setNumber(query, "maxPriceAmountMinor", criteria.maxPriceAmountMinor);
  setText(query, "currencyCode", criteria.currencyCode);
  setNumber(query, "minBedrooms", criteria.minBedrooms);
  setNumber(query, "maxBedrooms", criteria.maxBedrooms);
  setText(query, "availableFrom", criteria.availableFrom);
  setText(query, "availableTo", criteria.availableTo);
  setText(query, "q", criteria.q);
  if (criteria.sort !== undefined && criteria.sort !== DEFAULT_PUBLIC_CATALOG_SORT) query.set("sort", criteria.sort);
  if (criteria.cursor !== undefined && criteria.cursor.length > 0) query.set("cursor", criteria.cursor);
  return query;
}

export function serializePublicCatalogUrlState(criteria: PublicCatalogSearchQuery): URLSearchParams {
  const query = serializePublicCatalogQuery(criteria);
  query.delete("limit");
  return query;
}

function parseList<T extends string>(params: URLSearchParams, name: string, allowed: readonly T[]): readonly T[] | undefined {
  const values = params.getAll(name).flatMap((value) => value.split(","));
  const parsed = [...new Set(values.filter((value): value is T => allowed.includes(value as T)))];
  return parsed.length === 0 ? undefined : parsed;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && allowed.includes(value as T) ? value as T : undefined;
}

function canonicalCode(value: string | null, pattern: RegExp): string | undefined {
  const normalized = value?.trim().toUpperCase();
  return normalized !== undefined && pattern.test(normalized) ? normalized : undefined;
}

function text(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 || normalized.length > 200 ? undefined : normalized;
}

function integer(value: string | null, maximum: number, minimum = 0): number | undefined {
  if (value === null || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function instant(value: string | null): string | undefined {
  return value !== null && UTC_INSTANT.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function setList(query: URLSearchParams, name: string, values: readonly string[] | undefined): void {
  const present = values?.filter((value) => value.length > 0);
  if (present !== undefined && present.length > 0) query.set(name, [...new Set(present)].join(","));
}

function setText(query: URLSearchParams, name: string, value: string | undefined): void {
  if (value !== undefined && value.trim().length > 0) query.set(name, value);
}

function setNumber(query: URLSearchParams, name: string, value: number | undefined): void {
  if (value !== undefined) query.set(name, String(value));
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export type { PropertyStructuralRole, PropertyType, TransactionType };
