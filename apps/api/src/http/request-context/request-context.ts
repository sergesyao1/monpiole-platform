export const REQUEST_CONTEXT = Symbol("monpiole.request-context");

export interface HttpRequestContext {
  readonly tenantId?: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly idempotencyKey?: string;
}

export interface RequestWithContext {
  readonly headers: Record<string, string | string[] | undefined>;
  [REQUEST_CONTEXT]?: HttpRequestContext;
}
