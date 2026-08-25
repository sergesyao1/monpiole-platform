import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { ZodSerializerDto } from "nestjs-zod";

import type { ContractBaselineResponse } from "../../contracts/v1/contract-baseline/contract-baseline.schema.js";
import {
  ContractBaselineRequestDto,
  ContractBaselineResponseDto,
  ProblemDetailsDto,
} from "./contract-baseline.dto.js";
import { toContractBaselineInput } from "./contract-baseline.mapper.js";
import {
  Idempotency,
  TenantContext,
} from "../request-context/request-context.decorator.js";
import {
  REQUEST_CONTEXT,
  type RequestWithContext,
} from "../request-context/request-context.js";

@ApiTags("Contract baseline")
@ApiExtraModels(ProblemDetailsDto)
@Controller("api/v1/contract-baseline")
export class ContractBaselineController {
  @Post()
  @HttpCode(200)
  @TenantContext("required")
  @Idempotency("required")
  @ApiOperation({
    operationId: "proveContractBaseline",
    summary: "Prove the TD-006 transport technology baseline",
    security: [],
  })
  @ApiHeader({ name: "X-Tenant-Id", required: true, schema: { type: "string" } })
  @ApiHeader({ name: "X-Correlation-Id", required: false, schema: { type: "string", format: "uuid" } })
  @ApiHeader({ name: "Idempotency-Key", required: true, schema: { type: "string", minLength: 1, maxLength: 255 } })
  @ApiOkResponse({
    description: "Validated technical echo response",
    type: ContractBaselineResponseDto,
    headers: {
      "X-Correlation-Id": { schema: { type: "string", format: "uuid" } },
      "X-Request-Id": { schema: { type: "string", format: "uuid" } },
    },
  })
  @ApiResponse({
    status: 400,
    description: "RFC 9457 validation problem",
    content: {
      "application/problem+json": {
        schema: { $ref: getSchemaPath(ProblemDetailsDto) },
      },
    },
  })
  @ZodSerializerDto(ContractBaselineResponseDto)
  execute(
    @Body() request: ContractBaselineRequestDto,
    @Req() httpRequest: RequestWithContext,
  ): ContractBaselineResponse {
    const input = toContractBaselineInput(request);
    const context = httpRequest[REQUEST_CONTEXT];
    if (context === undefined) {
      throw new Error("Request context was not established");
    }
    return {
      message: input.message,
      context: {
        tenantId: context.tenantId!,
        correlationId: context.correlationId,
        requestId: context.requestId,
        idempotencyKey: context.idempotencyKey!,
      },
    };
  }
}
