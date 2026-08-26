import { publicWebConfig } from "../../config/public-config.js";
import { ApiProblem, isProblemDetails } from "./problem-details.js";

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  readonly body?: unknown;
  readonly accessToken?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export async function requestJson<ResponseBody>(
  path: `/v1/${string}`,
  options: ApiRequestOptions = {},
): Promise<ResponseBody> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("x-correlation-id", crypto.randomUUID());
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.accessToken !== undefined) headers.set("authorization", `Bearer ${options.accessToken}`);

  const response = await fetch(`${publicWebConfig.apiBaseUrl}${path}`, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
  });

  if (response.status === 204) return undefined as ResponseBody;
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (isProblemDetails(payload)) throw new ApiProblem(payload);
    throw new Error("La réponse du serveur n'a pas pu être traitée.");
  }
  return payload as ResponseBody;
}
