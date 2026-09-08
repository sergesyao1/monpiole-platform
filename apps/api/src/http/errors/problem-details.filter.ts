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
        : publicationErrors(exception);
    const correlationId = request[REQUEST_CONTEXT]?.correlationId ?? randomFallbackId();
    const requestId = request[REQUEST_CONTEXT]?.requestId ?? randomFallbackId();
    response.setHeader("X-Correlation-Id", correlationId);
    response.setHeader("X-Request-Id", requestId);
    response.setHeader("Cache-Control", "no-store");
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
  if (code === "PUBLIC_CATALOG_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/public-catalog-not-found",
    title: "Public catalog not found", code: "PUBLIC_CATALOG_NOT_FOUND",
  };
  if (code === "PUBLIC_PROPERTY_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/public-property-not-found",
    title: "Public Property not found", code: "PUBLIC_PROPERTY_NOT_FOUND",
  };
  if (code === "INVALID_PUBLIC_PROPERTY_CATALOG_QUERY") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET") return {
    status: 409,
    type: "https://api.monpiole.example/problems/property-publication-requirements-not-met",
    title: "Property publication requirements not met",
    code: "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET",
  };
  if (code === "PROPERTY_NOT_PUBLISHED") return {
    status: 409,
    type: "https://api.monpiole.example/problems/property-not-published",
    title: "Property is not published",
    code: "PROPERTY_NOT_PUBLISHED",
  };
  if (code === "PROPERTY_REPUBLICATION_NOT_SUPPORTED") return {
    status: 409,
    type: "https://api.monpiole.example/problems/property-republication-not-supported",
    title: "Property republication is not supported",
    code: "PROPERTY_REPUBLICATION_NOT_SUPPORTED",
  };
  if (code === "PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS") return {
    status: 409,
    type: "https://api.monpiole.example/problems/property-availability-derived-from-units",
    title: "Property availability is derived from Units",
    code: "PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS",
  };
  if (code === "PROPERTY_PHOTO_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/property-photo-not-found",
    title: "Property photo not found", code: "PROPERTY_PHOTO_NOT_FOUND",
  };
  if (code === "PROPERTY_PRIMARY_PHOTO_DELETION_FORBIDDEN") return {
    status: 409, type: "https://api.monpiole.example/problems/property-primary-photo-deletion-forbidden",
    title: "Property primary photo deletion forbidden", code: "PROPERTY_PRIMARY_PHOTO_DELETION_FORBIDDEN",
  };
  if (code === "PROPERTY_PUBLISHED_PHOTO_MUTATION_FORBIDDEN") return {
    status: 409, type: "https://api.monpiole.example/problems/property-published-photo-mutation-forbidden",
    title: "Published Property photo mutation forbidden", code: "PROPERTY_PUBLISHED_PHOTO_MUTATION_FORBIDDEN",
  };
  if (code === "INVALID_PROPERTY_PHOTO_CONTENT" || code === "INVALID_PROPERTY_PHOTO_STANDARD"
    || code === "INVALID_PROPERTY_PHOTO_ORDER") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "PROPERTY_BUILDING_NOT_FOUND" || code === "PROPERTY_UNIT_NOT_FOUND") return {
    status: 404, type: `https://api.monpiole.example/problems/${code === "PROPERTY_BUILDING_NOT_FOUND" ? "property-building" : "property-unit"}-not-found`,
    title: code === "PROPERTY_BUILDING_NOT_FOUND" ? "Property building not found" : "Property unit not found", code,
  };
  if (code === "PROPERTY_COMPOSITION_ROLE_CONFLICT" || code === "PROPERTY_BUILDING_CODE_CONFLICT" || code === "PROPERTY_UNIT_CODE_CONFLICT") return {
    status: 409, type: "https://api.monpiole.example/problems/property-composition-conflict", title: "Property composition conflict", code,
  };
  if (code === "INVALID_PROPERTY_COMPOSITION_INPUT") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request", title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "INVALID_PROPERTY_INPUT") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "INVALID_PROPERTY_GEOLOCATION_INPUT") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "PROPERTY_UNIT_GEOLOCATION_INHERITED") return {
    status: 409, type: "https://api.monpiole.example/problems/property-unit-geolocation-inherited",
    title: "Property Unit geolocation must be inherited", code: "PROPERTY_UNIT_GEOLOCATION_INHERITED",
  };
  if (code === "INVALID_PROPERTY_PORTFOLIO_QUERY") return {
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
  if (code === "INVALID_PROPERTY_OWNER_DIRECTORY_QUERY") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "INVALID_PROPERTY_OWNERSHIP_INPUT") return {
    status: 400, type: "https://api.monpiole.example/problems/invalid-request",
    title: "Invalid request", code: "INVALID_REQUEST",
  };
  if (code === "PROPERTY_OWNERSHIP_CONFLICT" || code === "PROPERTY_OWNERSHIP_SHARE_EXCEEDED") return {
    status: 409, type: "https://api.monpiole.example/problems/property-ownership-conflict",
    title: "Property ownership conflict", code,
  };
  if (code === "PROPERTY_OWNERSHIP_NOT_FOUND") return {
    status: 404, type: "https://api.monpiole.example/problems/property-ownership-not-found",
    title: "Property ownership not found", code: "PROPERTY_OWNERSHIP_NOT_FOUND",
  };
  return undefined;
}

function publicationErrors(exception: unknown): readonly { readonly path: string; readonly code: string }[] | undefined {
  if (errorCode(exception) !== "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET"
    || exception === null || typeof exception !== "object" || !("missingRequirements" in exception)
    || !Array.isArray(exception.missingRequirements)) return undefined;
  const missing = new Set(exception.missingRequirements);
  return [
    ...(missing.has("DETAILS") ? [{ path: "property.details", code: "required_for_publication" }] : []),
    ...(missing.has("COMMERCIAL_TERMS") ? [{ path: "property.commercialTerms", code: "required_for_publication" }] : []),
    ...(missing.has("APARTMENT_SUBTYPE") ? [{ path: "property.apartmentSubtype", code: "required_for_publication" }] : []),
    ...(missing.has("PRIMARY_PHOTO") ? [{ path: "property.primaryPhoto", code: "required_for_publication" }] : []),
    ...(missing.has("PHOTO_MINIMUM") ? [{ path: "property.photos", code: "minimum_for_publication" }] : []),
    ...(missing.has("PHOTO_REQUIRED_VIEWS") ? [{ path: "property.photos", code: "required_views_for_publication" }] : []),
  ];
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
