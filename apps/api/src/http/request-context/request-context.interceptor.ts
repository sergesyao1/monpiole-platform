import { randomUUID } from "node:crypto";

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";

import {
  CorrelationIdSchema,
  IdempotencyKeySchema,
  TenantIdSchema,
} from "../../contracts/v1/common/context.schema.js";
import { TransportValidationException } from "../errors/transport-validation.exception.js";
import {
  IDEMPOTENCY_METADATA,
  TENANT_CONTEXT_METADATA,
  type TenantContextRequirement,
} from "./request-context.decorator.js";
import {
  REQUEST_CONTEXT,
  type RequestWithContext,
} from "./request-context.js";

interface ResponseHeaders {
  setHeader(name: string, value: string): void;
}

function singleHeader(
  headers: RequestWithContext["headers"],
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseOptionalHeader(
  value: string | undefined,
  schema: typeof CorrelationIdSchema | typeof TenantIdSchema | typeof IdempotencyKeySchema,
  path: string,
): string | undefined {
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new TransportValidationException([{ path, code: "invalid" }]);
  }
  return parsed.data;
}

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context.switchToHttp().getResponse<ResponseHeaders>();
    const tenantRequirement = this.reflector.getAllAndOverride<TenantContextRequirement>(
      TENANT_CONTEXT_METADATA,
      [context.getHandler(), context.getClass()],
    ) ?? "not-applicable";
    const idempotencyRequirement = this.reflector.getAllAndOverride<"required" | "optional">(
      IDEMPOTENCY_METADATA,
      [context.getHandler(), context.getClass()],
    ) ?? "optional";

    const suppliedCorrelationId = singleHeader(request.headers, "x-correlation-id");
    const correlationId = parseOptionalHeader(
      suppliedCorrelationId,
      CorrelationIdSchema,
      "headers.x-correlation-id",
    ) ?? randomUUID();
    const requestId = randomUUID();
    const tenantId = parseOptionalHeader(
      singleHeader(request.headers, "x-tenant-id"),
      TenantIdSchema,
      "headers.x-tenant-id",
    );
    const idempotencyKey = parseOptionalHeader(
      singleHeader(request.headers, "idempotency-key"),
      IdempotencyKeySchema,
      "headers.idempotency-key",
    );

    if (tenantRequirement === "required" && tenantId === undefined) {
      throw new TransportValidationException([
        { path: "headers.x-tenant-id", code: "missing" },
      ]);
    }
    if (tenantRequirement === "not-applicable" && tenantId !== undefined) {
      throw new TransportValidationException([
        { path: "headers.x-tenant-id", code: "not-applicable" },
      ]);
    }
    if (idempotencyRequirement === "required" && idempotencyKey === undefined) {
      throw new TransportValidationException([
        { path: "headers.idempotency-key", code: "missing" },
      ]);
    }

    request[REQUEST_CONTEXT] = {
      ...(tenantId === undefined ? {} : { tenantId }),
      correlationId,
      requestId,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    };
    response.setHeader("X-Correlation-Id", correlationId);
    response.setHeader("X-Request-Id", requestId);
    return next.handle();
  }
}
