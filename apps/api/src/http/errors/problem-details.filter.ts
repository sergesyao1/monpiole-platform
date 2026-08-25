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
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
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
      type: isClientError
        ? "https://api.monpiole.example/problems/invalid-request"
        : "https://api.monpiole.example/problems/internal-error",
      title: isClientError ? "Invalid request" : "Internal server error",
      status,
      code: isClientError ? "INVALID_REQUEST" : "INTERNAL_ERROR",
      correlationId,
      ...(errors === undefined ? {} : { errors }),
    });
    response.status(status).type("application/problem+json").json(problem);
  }
}

function randomFallbackId(): string {
  return randomUUID();
}
import { randomUUID } from "node:crypto";
