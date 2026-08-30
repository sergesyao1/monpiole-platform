import { publicWebConfig } from "../../config/public-config.js";
import { ApiProblem, isProblemDetails } from "./problem-details.js";

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface AccessTokenProvider { readonly getAccessToken: (fresh?: boolean) => Promise<string>; }

export class ApiSessionExpiredError extends Error {
  constructor() { super("Votre session a expiré. Veuillez vous reconnecter."); }
}

export class ApiForbiddenError extends Error {
  constructor() { super("Vous n’êtes pas autorisé à effectuer cette action."); }
}

export async function requestJson<ResponseBody>(
  path: `/v1/${string}`,
  options: ApiRequestOptions = {},
): Promise<ResponseBody> {
  return performRequest<ResponseBody>(path, options);
}

export function createAuthenticatedApiClient(tokens: AccessTokenProvider) {
  return async function requestAuthenticatedJson<ResponseBody>(path: `/v1/${string}`, options: ApiRequestOptions = {}): Promise<ResponseBody> {
    let response = await performFetch(path, options, await tokens.getAccessToken());
    if (response.status === 401) response = await performFetch(path, options, await tokens.getAccessToken(true));
    return readResponse<ResponseBody>(response);
  };
}

export function createAuthenticatedBinaryApiClient(tokens: AccessTokenProvider) {
  return async function requestAuthenticatedBinary(path: `/v1/${string}`): Promise<Blob> {
    let response = await performFetch(path, {}, await tokens.getAccessToken());
    if (response.status === 401) response = await performFetch(path, {}, await tokens.getAccessToken(true));
    if (!response.ok) await readResponse<never>(response);
    return response.blob();
  };
}

async function performRequest<ResponseBody>(path: `/v1/${string}`, options: ApiRequestOptions): Promise<ResponseBody> {
  return readResponse<ResponseBody>(await performFetch(path, options));
}

async function performFetch(path: `/v1/${string}`, options: ApiRequestOptions, accessToken?: string): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("x-correlation-id", crypto.randomUUID());
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (accessToken !== undefined) headers.set("authorization", `Bearer ${accessToken}`);

  return fetch(`${publicWebConfig.apiBaseUrl}${path}`, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
  });
}

async function readResponse<ResponseBody>(response: Response): Promise<ResponseBody> {
  if (response.status === 204) return undefined as ResponseBody;
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401) throw new ApiSessionExpiredError();
    if (response.status === 403) throw new ApiForbiddenError();
    if (isProblemDetails(payload)) throw new ApiProblem(payload);
    throw new Error("La réponse du serveur n'a pas pu être traitée.");
  }
  return payload as ResponseBody;
}
