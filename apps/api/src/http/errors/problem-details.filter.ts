import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";
import { z } from "zod";

import {
  ProblemDetailsSchema,
  type ProblemDetails,
} from "../../contracts/v1/common/problem-details.schema.js";
import {
  REQUEST_CONTEXT,
  type RequestWithContext,
} from "../request-context/request-context.js";
import { TransportValidationException } from "./transport-validation.exception.js";

interface ProblemResponse {
  setHeader(name: string, value: string): void;
  status(status: number): this;
  type(contentType: string): this;
  json(body: ProblemDetails): void;
}

function zodErrors(exception: ZodValidationException) {
  const error = exception.getZodError();
  if (!(error instanceof z.ZodError)) return undefined;
  return error.issues.map((issue) => ({
    path: ["body", ...issue.path.map(String)].join("."),
    code: "invalid",
  }));
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<ProblemResponse>();
    const mapped = businessProblem(exception);
    const status = mapped?.status ?? (exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR);
    const isClientError = status >= 400 && status < 500;
    const errors = exception instanceof TransportValidationException
      ? [...exception.safeErrors]
      : exception instanceof ZodValidationException
        ? zodErrors(exception)
        : undefined;
    const correlationId = request[REQUEST_CONTEXT]?.correlationId ?? randomFallbackId();
    const requestId = request[REQUEST_CONTEXT]?.requestId ?? randomFallbackId();
    response.setHeader("X-Correlation-Id", correlationId);
    response.setHeader("X-Request-Id", requestId);
    const problem = ProblemDetailsSchema.parse({
      type: mapped?.type ?? (isClientError
        ? "https://api.monpiole.example/problems/invalid-request"
        : "https://api.monpiole.example/problems/internal-error"),
      title: mapped?.title ?? (isClientError ? "Invalid request" : "Internal server error"),
      status,
      code: mapped?.code ?? (isClientError ? "INVALID_REQUEST" : "INTERNAL_ERROR"),
      correlationId,
      ...(errors === undefined ? {} : { errors }),
    });
    response.status(status).type("application/problem+json").json(problem);
  }
}

function businessProblem(exception: unknown) {
  const code = errorCode(exception);
  if (exception instanceof HttpException && exception.getStatus() === 401) return {
    status: 401, type: "https://api.monpiole.example/problems/unauthorized",
    title: "Authentication required", code: "UNAUTHORIZED",
  };
  if (
    code === "CREATE_TENANT_FORBIDDEN"
    || code === "IDENTITY_ONBOARDING_FORBIDDEN"
    || code === "ACTIVATE_TENANT_FORBIDDEN"
    || (exception instanceof HttpException && exception.getStatus() === 403)
  ) return {
    status: 403, type: "https://api.monpiole.example/problems/forbidden",
    title: "Forbidden", code: "FORBIDDEN",
  };
  if (code === "DUPLICATE_TENANT_EMAIL") return {
    status: 409, type: "https://api.monpiole.example/problems/duplicate-tenant",
    title: "Tenant conflict", code: "DUPLICATE_TENANT",
  };
  if (code === "CREATE_TENANT_IDEMPOTENCY_CONFLICT") return {
    status: 409, type: "https://api.monpiole.example/problems/idempotency-conflict",
    title: "Idempotency conflict", code: "IDEMPOTENCY_CONFLICT",
  };
  if (code === "INVALID_TENANT_INPUT") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "BOOTSTRAP_TENANT_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/tenant-not-found",
    title: "Tenant not found", code: "TENANT_NOT_FOUND",
  };
  if (code === "BOOTSTRAP_ADMINISTRATOR_CONFLICT") return {
    status: 409, type: "https://api.monpiole.example/problems/administrator-conflict",
    title: "Administrator conflict", code: "ADMINISTRATOR_CONFLICT",
  };
  if (code === "INVALID_BOOTSTRAP_ADMINISTRATOR") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "TENANT_ADMINISTRATOR_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/tenant-administrator-not-found",
    title: "Tenant administrator not found", code: "TENANT_ADMINISTRATOR_NOT_FOUND",
  };
  if (code === "ACTIVATE_TENANT_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/tenant-not-found",
    title: "Tenant not found", code: "TENANT_NOT_FOUND",
  };
  if (code === "TENANT_ADMINISTRATOR_NOT_READY") return {
    status: 409, type: "https://api.monpiole.example/problems/tenant-administrator-not-ready",
    title: "Tenant administrator not ready", code: "TENANT_ADMINISTRATOR_NOT_READY",
  };
  if (code === "PROPERTY_FORBIDDEN") return {
    status: 403, type: "https://api.monpiole.example/problems/forbidden",
    title: "Forbidden", code: "FORBIDDEN",
  };
  if (code === "PROPERTY_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/property-not-found",
    title: "Property not found", code: "PROPERTY_NOT_FOUND",
  };
  if (code === "INVALID_PROPERTY_INPUT") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "INVALID_PROPERTY_DETAILS" || code === "INCOMPATIBLE_COMMERCIAL_TERMS") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "PROPERTY_OWNER_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/property-owner-not-found",
    title: "Property owner not found", code: "PROPERTY_OWNER_NOT_FOUND",
  };
  if (code === "INVALID_PROPERTY_OWNER_INPUT" || code === "PROPERTY_OWNER_TYPE_CHANGE_NOT_ALLOWED") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code,
  };
  return undefined;
}

function errorCode(exception: unknown): string | undefined {
  return exception !== null && typeof exception === "object" && "code" in exception && typeof exception.code === "string"
    ? exception.code
    : undefined;
}

function randomFallbackId(): string {
  return randomUUID();
}
import { randomUUID } from "node:crypto";
