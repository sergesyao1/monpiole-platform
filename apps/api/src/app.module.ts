import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import {
  ZodSerializerInterceptor,
  createZodValidationPipe,
} from "nestjs-zod";

import { ContractBaselineController } from "./http/contract-baseline/contract-baseline.controller.js";
import { ProblemDetailsFilter } from "./http/errors/problem-details.filter.js";
import { RequestContextInterceptor } from "./http/request-context/request-context.interceptor.js";
import { HealthController } from "./health/health.controller.js";

const StrictZodValidationPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
});

@Module({
  controllers: [HealthController, ContractBaselineController],
  providers: [
    { provide: APP_PIPE, useClass: StrictZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
