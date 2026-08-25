import { type DynamicModule, Module } from "@nestjs/common";
import type { CreateTenant } from "@monpiole/tenant-management";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import {
  ZodSerializerInterceptor,
  createZodValidationPipe,
} from "nestjs-zod";

import { ContractBaselineController } from "./http/contract-baseline/contract-baseline.controller.js";
import { ProblemDetailsFilter } from "./http/errors/problem-details.filter.js";
import { RequestContextInterceptor } from "./http/request-context/request-context.interceptor.js";
import { HealthController } from "./health/health.controller.js";
import {
  CREATE_TENANT_USE_CASE,
  CreateTenantController,
  PLATFORM_AUTHORITY_PROVIDER,
  type PlatformAuthorityProvider,
} from "./http/tenants/create-tenant.controller.js";

const StrictZodValidationPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
});

export interface ApiComposition {
  readonly createTenant?: Pick<CreateTenant, "execute">;
  readonly platformAuthorityProvider?: PlatformAuthorityProvider;
}

const unavailableCreateTenant: Pick<CreateTenant, "execute"> = {
  async execute() { throw new Error("Create Tenant production composition is unavailable"); },
};

const unavailableAuthority: PlatformAuthorityProvider = {
  async resolve() { return undefined; },
};

@Module({})
export class AppModule {
  static register(composition: ApiComposition = {}): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, ContractBaselineController, CreateTenantController],
      providers: [
        { provide: APP_PIPE, useClass: StrictZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        { provide: CREATE_TENANT_USE_CASE, useValue: composition.createTenant ?? unavailableCreateTenant },
        { provide: PLATFORM_AUTHORITY_PROVIDER, useValue: composition.platformAuthorityProvider ?? unavailableAuthority },
      ],
    };
  }
}
