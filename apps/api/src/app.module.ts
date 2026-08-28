import { type DynamicModule, Module } from "@nestjs/common";
import type { ActivateTenant, CreateTenant, PlatformAuthorityAuthorizer } from "@monpiole/tenant-management";
import type { ActivateTenantAdministrator, BootstrapTenantAdministrator } from "@monpiole/identity";
import type {
  CreateProperty, CreatePropertyOwner, ListProperties, ListPropertyOwners, RetrieveProperty, RetrievePropertyOwner,
  UpdatePropertyCoreInformation, UpdatePropertyDetails, UpdatePropertyOwner, AssignPropertyOwner,
  RetrievePropertyOwnerships, RemovePropertyOwner, CreatePropertyBuilding, ListPropertyBuildings, UpdatePropertyBuilding,
  CreatePropertyUnit, ListPropertyUnits, UpdatePropertyUnitStructure,
} from "@monpiole/property-management";
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
} from "./http/tenants/create-tenant.controller.js";
import {
  BOOTSTRAP_TENANT_ADMINISTRATOR,
  BootstrapAdministratorController,
} from "./http/tenants/bootstrap-administrator.controller.js";
import {
  ACTIVATE_TENANT_ADMINISTRATOR,
  ActivateAdministratorController,
} from "./http/tenants/activate-administrator.controller.js";
import { ACTIVATE_TENANT_USE_CASE, ActivateTenantController } from "./http/tenants/activate-tenant.controller.js";
import {
  AUTHENTICATED_AUTHORITY_PROVIDER,
  type AuthenticatedAuthorityProvider,
} from "./http/authenticated-authority/authenticated-authority.js";
import { CREATE_PROPERTY_USE_CASE, CreatePropertyController } from "./http/properties/create-property.controller.js";
import { RETRIEVE_PROPERTY_USE_CASE, RetrievePropertyController } from "./http/properties/retrieve-property.controller.js";
import { LIST_PROPERTIES_USE_CASE, ListPropertiesController } from "./http/properties/list-properties.controller.js";
import { UPDATE_PROPERTY_DETAILS_USE_CASE, UpdatePropertyDetailsController } from "./http/properties/update-property-details.controller.js";
import { UPDATE_PROPERTY_CORE_INFORMATION_USE_CASE, UpdatePropertyCoreInformationController } from "./http/properties/update-property-core-information.controller.js";
import { CREATE_PROPERTY_OWNER_USE_CASE, CreatePropertyOwnerController } from "./http/properties/create-property-owner.controller.js";
import { RETRIEVE_PROPERTY_OWNER_USE_CASE, RetrievePropertyOwnerController } from "./http/properties/retrieve-property-owner.controller.js";
import { UPDATE_PROPERTY_OWNER_USE_CASE, UpdatePropertyOwnerController } from "./http/properties/update-property-owner.controller.js";
import { LIST_PROPERTY_OWNERS_USE_CASE, ListPropertyOwnersController } from "./http/properties/list-property-owners.controller.js";
import { ASSIGN_PROPERTY_OWNER_USE_CASE, AssignPropertyOwnerController } from "./http/properties/assign-property-owner.controller.js";
import { RETRIEVE_PROPERTY_OWNERSHIPS_USE_CASE, RetrievePropertyOwnershipsController } from "./http/properties/retrieve-property-ownerships.controller.js";
import { REMOVE_PROPERTY_OWNER_USE_CASE, RemovePropertyOwnerController } from "./http/properties/remove-property-owner.controller.js";
import { AuthenticationSessionController } from "./http/authentication/authentication-session.controller.js";
import {
  PLATFORM_AUTHORITY_AUTHORIZER,
  PlatformTenantCreationAuthorizationProbeController,
} from "./http/authentication/platform-tenant-creation-authorization-probe.controller.js";
import { PropertyCompositionController, CREATE_PROPERTY_BUILDING, LIST_PROPERTY_BUILDINGS, UPDATE_PROPERTY_BUILDING, CREATE_PROPERTY_UNIT, LIST_PROPERTY_UNITS, UPDATE_PROPERTY_UNIT } from "./http/properties/property-composition.controller.js";

const StrictZodValidationPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
});

export interface ApiComposition {
  readonly createTenant?: Pick<CreateTenant, "execute">;
  readonly authenticatedAuthorityProvider?: AuthenticatedAuthorityProvider;
  readonly platformAuthorityAuthorizer?: PlatformAuthorityAuthorizer;
  readonly bootstrapTenantAdministrator?: Pick<BootstrapTenantAdministrator, "execute">;
  readonly activateTenantAdministrator?: Pick<ActivateTenantAdministrator, "execute">;
  readonly activateTenant?: Pick<ActivateTenant, "execute">;
  readonly createProperty?: Pick<CreateProperty, "execute">;
  readonly retrieveProperty?: Pick<RetrieveProperty, "execute">;
  readonly listProperties?: Pick<ListProperties, "execute">;
  readonly updatePropertyDetails?: Pick<UpdatePropertyDetails, "execute">;
  readonly updatePropertyCoreInformation?: Pick<UpdatePropertyCoreInformation, "execute">;
  readonly createPropertyOwner?: Pick<CreatePropertyOwner, "execute">;
  readonly retrievePropertyOwner?: Pick<RetrievePropertyOwner, "execute">;
  readonly listPropertyOwners?: Pick<ListPropertyOwners, "execute">;
  readonly updatePropertyOwner?: Pick<UpdatePropertyOwner, "execute">;
  readonly assignPropertyOwner?: Pick<AssignPropertyOwner, "execute">;
  readonly retrievePropertyOwnerships?: Pick<RetrievePropertyOwnerships, "execute">;
  readonly removePropertyOwner?: Pick<RemovePropertyOwner, "execute">;
  readonly createPropertyBuilding?: Pick<CreatePropertyBuilding, "execute">; readonly listPropertyBuildings?: Pick<ListPropertyBuildings, "execute">;
  readonly updatePropertyBuilding?: Pick<UpdatePropertyBuilding, "execute">; readonly createPropertyUnit?: Pick<CreatePropertyUnit, "execute">;
  readonly listPropertyUnits?: Pick<ListPropertyUnits, "execute">; readonly updatePropertyUnitStructure?: Pick<UpdatePropertyUnitStructure, "execute">;
  readonly runtimeShutdown?: RuntimeShutdown;
}

export interface RuntimeShutdown { onApplicationShutdown(): Promise<void>; }
export const RUNTIME_SHUTDOWN = Symbol("monpiole.runtime-shutdown");

const unavailableCreateTenant: Pick<CreateTenant, "execute"> = {
  async execute() { throw new Error("Create Tenant production composition is unavailable"); },
};

const unavailableAuthority: AuthenticatedAuthorityProvider = {
  async resolve() { return undefined; },
};
const denyPlatformAuthority: PlatformAuthorityAuthorizer = {
  async authorizeCreateTenant() { return false; },
};

const unavailableBootstrapAdministrator: Pick<BootstrapTenantAdministrator, "execute"> = {
  async execute() { throw new Error("Bootstrap Tenant Administrator composition is unavailable"); },
};
const unavailableActivateAdministrator: Pick<ActivateTenantAdministrator, "execute"> = {
  async execute() { throw new Error("Activate Tenant Administrator composition is unavailable"); },
};
const unavailableActivateTenant: Pick<ActivateTenant, "execute"> = {
  async execute() { throw new Error("Activate Tenant production composition is unavailable"); },
};
const unavailableCreateProperty: Pick<CreateProperty, "execute"> = { async execute() { throw new Error("Create Property composition is unavailable"); } };
const unavailableRetrieveProperty: Pick<RetrieveProperty, "execute"> = { async execute() { throw new Error("Retrieve Property composition is unavailable"); } };
const unavailableListProperties: Pick<ListProperties, "execute"> = { async execute() { throw new Error("List Properties composition is unavailable"); } };
const unavailableUpdatePropertyDetails: Pick<UpdatePropertyDetails, "execute"> = { async execute() { throw new Error("Update Property Details composition is unavailable"); } };
const unavailableUpdatePropertyCoreInformation: Pick<UpdatePropertyCoreInformation, "execute"> = { async execute() { throw new Error("Update Property Core Information composition is unavailable"); } };
const unavailableCreatePropertyOwner: Pick<CreatePropertyOwner, "execute"> = { async execute() { throw new Error("Create Property Owner composition is unavailable"); } };
const unavailableRetrievePropertyOwner: Pick<RetrievePropertyOwner, "execute"> = { async execute() { throw new Error("Retrieve Property Owner composition is unavailable"); } };
const unavailableListPropertyOwners: Pick<ListPropertyOwners, "execute"> = { async execute() { throw new Error("List Property Owners composition is unavailable"); } };
const unavailableUpdatePropertyOwner: Pick<UpdatePropertyOwner, "execute"> = { async execute() { throw new Error("Update Property Owner composition is unavailable"); } };
const unavailableAssignPropertyOwner: Pick<AssignPropertyOwner, "execute"> = { async execute() { throw new Error("Assign Property Owner composition is unavailable"); } };
const unavailableRetrievePropertyOwnerships: Pick<RetrievePropertyOwnerships, "execute"> = { async execute() { throw new Error("Retrieve Property Ownerships composition is unavailable"); } };
const unavailableRemovePropertyOwner: Pick<RemovePropertyOwner, "execute"> = { async execute() { throw new Error("Remove Property Owner composition is unavailable"); } };
const unavailableComposition = { async execute(): Promise<never> { throw new Error("Property composition is unavailable"); } };

@Module({})
export class AppModule {
  static register(composition: ApiComposition = {}): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController, ContractBaselineController, AuthenticationSessionController,
        PlatformTenantCreationAuthorizationProbeController, CreateTenantController,
        BootstrapAdministratorController,
        ActivateAdministratorController,
        ActivateTenantController,
        CreatePropertyController, ListPropertiesController, RetrievePropertyController,
        UpdatePropertyCoreInformationController, UpdatePropertyDetailsController,
        CreatePropertyOwnerController, ListPropertyOwnersController, RetrievePropertyOwnerController, UpdatePropertyOwnerController,
        AssignPropertyOwnerController, RetrievePropertyOwnershipsController, RemovePropertyOwnerController, PropertyCompositionController,
      ],
      providers: [
        { provide: APP_PIPE, useClass: StrictZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        { provide: CREATE_TENANT_USE_CASE, useValue: composition.createTenant ?? unavailableCreateTenant },
        {
          provide: AUTHENTICATED_AUTHORITY_PROVIDER,
          useValue: composition.authenticatedAuthorityProvider ?? unavailableAuthority,
        },
        {
          provide: PLATFORM_AUTHORITY_AUTHORIZER,
          useValue: composition.platformAuthorityAuthorizer ?? denyPlatformAuthority,
        },
        {
          provide: BOOTSTRAP_TENANT_ADMINISTRATOR,
          useValue: composition.bootstrapTenantAdministrator ?? unavailableBootstrapAdministrator,
        },
        {
          provide: ACTIVATE_TENANT_ADMINISTRATOR,
          useValue: composition.activateTenantAdministrator ?? unavailableActivateAdministrator,
        },
        { provide: ACTIVATE_TENANT_USE_CASE, useValue: composition.activateTenant ?? unavailableActivateTenant },
        { provide: CREATE_PROPERTY_USE_CASE, useValue: composition.createProperty ?? unavailableCreateProperty },
        { provide: RETRIEVE_PROPERTY_USE_CASE, useValue: composition.retrieveProperty ?? unavailableRetrieveProperty },
        { provide: LIST_PROPERTIES_USE_CASE, useValue: composition.listProperties ?? unavailableListProperties },
        { provide: UPDATE_PROPERTY_DETAILS_USE_CASE, useValue: composition.updatePropertyDetails ?? unavailableUpdatePropertyDetails },
        { provide: UPDATE_PROPERTY_CORE_INFORMATION_USE_CASE, useValue: composition.updatePropertyCoreInformation ?? unavailableUpdatePropertyCoreInformation },
        { provide: CREATE_PROPERTY_OWNER_USE_CASE, useValue: composition.createPropertyOwner ?? unavailableCreatePropertyOwner },
        { provide: RETRIEVE_PROPERTY_OWNER_USE_CASE, useValue: composition.retrievePropertyOwner ?? unavailableRetrievePropertyOwner },
        { provide: LIST_PROPERTY_OWNERS_USE_CASE, useValue: composition.listPropertyOwners ?? unavailableListPropertyOwners },
        { provide: UPDATE_PROPERTY_OWNER_USE_CASE, useValue: composition.updatePropertyOwner ?? unavailableUpdatePropertyOwner },
        { provide: ASSIGN_PROPERTY_OWNER_USE_CASE, useValue: composition.assignPropertyOwner ?? unavailableAssignPropertyOwner },
        { provide: RETRIEVE_PROPERTY_OWNERSHIPS_USE_CASE, useValue: composition.retrievePropertyOwnerships ?? unavailableRetrievePropertyOwnerships },
        { provide: REMOVE_PROPERTY_OWNER_USE_CASE, useValue: composition.removePropertyOwner ?? unavailableRemovePropertyOwner },
        { provide: CREATE_PROPERTY_BUILDING, useValue: composition.createPropertyBuilding ?? unavailableComposition },
        { provide: LIST_PROPERTY_BUILDINGS, useValue: composition.listPropertyBuildings ?? unavailableComposition },
        { provide: UPDATE_PROPERTY_BUILDING, useValue: composition.updatePropertyBuilding ?? unavailableComposition },
        { provide: CREATE_PROPERTY_UNIT, useValue: composition.createPropertyUnit ?? unavailableComposition },
        { provide: LIST_PROPERTY_UNITS, useValue: composition.listPropertyUnits ?? unavailableComposition },
        { provide: UPDATE_PROPERTY_UNIT, useValue: composition.updatePropertyUnitStructure ?? unavailableComposition },
        ...(composition.runtimeShutdown === undefined
          ? []
          : [{ provide: RUNTIME_SHUTDOWN, useValue: composition.runtimeShutdown }]),
      ],
    };
  }
}
