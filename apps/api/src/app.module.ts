import { type DynamicModule, Module } from "@nestjs/common";
import type { ActivateTenant, CreateTenant, PlatformAuthorityAuthorizer } from "@monpiole/tenant-management";
import type { ActivateTenantAdministrator, BootstrapTenantAdministrator } from "@monpiole/identity";
import type {
  CreateProperty, CreatePropertyOwner, ListProperties, ListPropertyOwners, RetrieveProperty, RetrievePropertyOwner,
  SetPropertyPricing, UpdatePropertyCoreInformation, UpdatePropertyDetails, UpdatePropertyOwner, AssignPropertyOwner,
  RetrievePropertyOwnerships, RemovePropertyOwner, CreatePropertyBuilding, ListPropertyBuildings, UpdatePropertyBuilding,
  CreatePropertyUnit, ListPropertyUnits, UpdatePropertyUnitStructure, PublishProperty, WithdrawPropertyFromCatalog,
  ListPropertyPhotos, RegisterPropertyPhoto, RetrievePropertyPhotoContent, SelectPropertyPrimaryPhoto, DeletePropertyPhoto,
  RetrievePropertyPhotoStandard, UpdatePropertyPhotoStandard,
  ListPublicProperties, RetrievePublicProperty, RetrievePublicPrimaryPhoto,
  RetrievePropertyGeolocation, UpdatePropertyGeolocation, RemovePropertyGeolocation,
  RetrievePropertyAvailability, UpdatePropertyAvailability,
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
import { SET_PROPERTY_PRICING_USE_CASE, SetPropertyPricingController } from "./http/properties/set-property-pricing.controller.js";
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
import { PUBLISH_PROPERTY_USE_CASE, WITHDRAW_PROPERTY_FROM_CATALOG_USE_CASE, PublishPropertyController } from "./http/properties/publish-property.controller.js";
import { DELETE_PROPERTY_PHOTO_USE_CASE, LIST_PROPERTY_PHOTOS_USE_CASE, REGISTER_PROPERTY_PHOTO_USE_CASE, RETRIEVE_PROPERTY_PHOTO_CONTENT_USE_CASE, SELECT_PROPERTY_PRIMARY_PHOTO_USE_CASE, PropertyPhotosController } from "./http/properties/property-photos.controller.js";
import { PropertyPhotoStandardController, RETRIEVE_PROPERTY_PHOTO_STANDARD_USE_CASE, UPDATE_PROPERTY_PHOTO_STANDARD_USE_CASE } from "./http/properties/property-photo-standard.controller.js";
import {
  PropertyGeolocationController, REMOVE_PROPERTY_GEOLOCATION_USE_CASE,
  RETRIEVE_PROPERTY_GEOLOCATION_USE_CASE, UPDATE_PROPERTY_GEOLOCATION_USE_CASE,
} from "./http/properties/property-geolocation.controller.js";
import {
  LIST_PUBLIC_PROPERTIES_USE_CASE, PUBLIC_CATALOG_TENANT_RESOLVER,
  RETRIEVE_PUBLIC_PRIMARY_PHOTO_USE_CASE, RETRIEVE_PUBLIC_PROPERTY_USE_CASE,
  PublicPropertiesController,
} from "./http/public-properties/public-properties.controller.js";
import {
  AllowlistedPublicCatalogTenantResolver,
  type PublicCatalogTenantResolver,
} from "./configuration/public-catalog.js";
import {
  PropertyAvailabilityController,
  RETRIEVE_PROPERTY_AVAILABILITY_USE_CASE,
  UPDATE_PROPERTY_AVAILABILITY_USE_CASE,
} from "./http/properties/property-availability.controller.js";

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
  readonly setPropertyPricing?: Pick<SetPropertyPricing, "execute">;
  readonly updatePropertyCoreInformation?: Pick<UpdatePropertyCoreInformation, "execute">;
  readonly publishProperty?: Pick<PublishProperty, "execute">;
  readonly withdrawPropertyFromCatalog?: Pick<WithdrawPropertyFromCatalog, "execute">;
  readonly listPropertyPhotos?: Pick<ListPropertyPhotos, "execute">;
  readonly registerPropertyPhoto?: Pick<RegisterPropertyPhoto, "execute">;
  readonly retrievePropertyPhotoContent?: Pick<RetrievePropertyPhotoContent, "execute">;
  readonly selectPropertyPrimaryPhoto?: Pick<SelectPropertyPrimaryPhoto, "execute">;
  readonly deletePropertyPhoto?: Pick<DeletePropertyPhoto, "execute">;
  readonly retrievePropertyPhotoStandard?: Pick<RetrievePropertyPhotoStandard, "execute">;
  readonly updatePropertyPhotoStandard?: Pick<UpdatePropertyPhotoStandard, "execute">;
  readonly retrievePropertyGeolocation?: Pick<RetrievePropertyGeolocation, "execute">;
  readonly updatePropertyGeolocation?: Pick<UpdatePropertyGeolocation, "execute">;
  readonly removePropertyGeolocation?: Pick<RemovePropertyGeolocation, "execute">;
  readonly retrievePropertyAvailability?: Pick<RetrievePropertyAvailability, "execute">;
  readonly updatePropertyAvailability?: Pick<UpdatePropertyAvailability, "execute">;
  readonly publicCatalogTenantResolver?: PublicCatalogTenantResolver;
  readonly listPublicProperties?: Pick<ListPublicProperties, "execute">;
  readonly retrievePublicProperty?: Pick<RetrievePublicProperty, "execute">;
  readonly retrievePublicPrimaryPhoto?: Pick<RetrievePublicPrimaryPhoto, "execute">;
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
const unavailableSetPropertyPricing: Pick<SetPropertyPricing, "execute"> = { async execute() { throw new Error("Set Property Pricing composition is unavailable"); } };
const unavailableUpdatePropertyCoreInformation: Pick<UpdatePropertyCoreInformation, "execute"> = { async execute() { throw new Error("Update Property Core Information composition is unavailable"); } };
const unavailablePublishProperty: Pick<PublishProperty, "execute"> = { async execute() { throw new Error("Publish Property composition is unavailable"); } };
const unavailableWithdrawPropertyFromCatalog: Pick<WithdrawPropertyFromCatalog, "execute"> = { async execute() { throw new Error("Withdraw Property from catalog composition is unavailable"); } };
const unavailableListPropertyPhotos: Pick<ListPropertyPhotos, "execute"> = { async execute() { throw new Error("List Property photos composition is unavailable"); } };
const unavailableRegisterPropertyPhoto: Pick<RegisterPropertyPhoto, "execute"> = { async execute() { throw new Error("Register Property photo composition is unavailable"); } };
const unavailableRetrievePropertyPhotoContent: Pick<RetrievePropertyPhotoContent, "execute"> = { async execute() { throw new Error("Retrieve Property photo content composition is unavailable"); } };
const unavailableSelectPropertyPrimaryPhoto: Pick<SelectPropertyPrimaryPhoto, "execute"> = { async execute() { throw new Error("Select primary Property photo composition is unavailable"); } };
const unavailableDeletePropertyPhoto: Pick<DeletePropertyPhoto, "execute"> = { async execute() { throw new Error("Delete Property photo composition is unavailable"); } };
const unavailableRetrievePropertyPhotoStandard: Pick<RetrievePropertyPhotoStandard, "execute"> = { async execute() { throw new Error("Retrieve Property photo standard composition is unavailable"); } };
const unavailableUpdatePropertyPhotoStandard: Pick<UpdatePropertyPhotoStandard, "execute"> = { async execute() { throw new Error("Update Property photo standard composition is unavailable"); } };
const unavailableRetrievePropertyGeolocation: Pick<RetrievePropertyGeolocation, "execute"> = { async execute() { throw new Error("Retrieve Property geolocation composition is unavailable"); } };
const unavailableUpdatePropertyGeolocation: Pick<UpdatePropertyGeolocation, "execute"> = { async execute() { throw new Error("Update Property geolocation composition is unavailable"); } };
const unavailableRemovePropertyGeolocation: Pick<RemovePropertyGeolocation, "execute"> = { async execute() { throw new Error("Remove Property geolocation composition is unavailable"); } };
const unavailableRetrievePropertyAvailability: Pick<RetrievePropertyAvailability, "execute"> = { async execute() { throw new Error("Retrieve Property availability composition is unavailable"); } };
const unavailableUpdatePropertyAvailability: Pick<UpdatePropertyAvailability, "execute"> = { async execute() { throw new Error("Update Property availability composition is unavailable"); } };
const unavailableListPublicProperties: Pick<ListPublicProperties, "execute"> = { async execute() { throw new Error("Public Property catalog composition is unavailable"); } };
const unavailableRetrievePublicProperty: Pick<RetrievePublicProperty, "execute"> = { async execute() { throw new Error("Public Property detail composition is unavailable"); } };
const unavailableRetrievePublicPrimaryPhoto: Pick<RetrievePublicPrimaryPhoto, "execute"> = { async execute() { throw new Error("Public Property photo composition is unavailable"); } };
const unavailablePublicCatalogTenantResolver = new AllowlistedPublicCatalogTenantResolver(new Map());
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
        UpdatePropertyCoreInformationController, UpdatePropertyDetailsController, SetPropertyPricingController,
        PublishPropertyController,
        PropertyPhotosController, PropertyPhotoStandardController, PropertyGeolocationController, PropertyAvailabilityController,
        PublicPropertiesController,
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
        { provide: SET_PROPERTY_PRICING_USE_CASE, useValue: composition.setPropertyPricing ?? unavailableSetPropertyPricing },
        { provide: UPDATE_PROPERTY_CORE_INFORMATION_USE_CASE, useValue: composition.updatePropertyCoreInformation ?? unavailableUpdatePropertyCoreInformation },
        { provide: PUBLISH_PROPERTY_USE_CASE, useValue: composition.publishProperty ?? unavailablePublishProperty },
        { provide: WITHDRAW_PROPERTY_FROM_CATALOG_USE_CASE, useValue: composition.withdrawPropertyFromCatalog ?? unavailableWithdrawPropertyFromCatalog },
        { provide: LIST_PROPERTY_PHOTOS_USE_CASE, useValue: composition.listPropertyPhotos ?? unavailableListPropertyPhotos },
        { provide: REGISTER_PROPERTY_PHOTO_USE_CASE, useValue: composition.registerPropertyPhoto ?? unavailableRegisterPropertyPhoto },
        { provide: RETRIEVE_PROPERTY_PHOTO_CONTENT_USE_CASE, useValue: composition.retrievePropertyPhotoContent ?? unavailableRetrievePropertyPhotoContent },
        { provide: SELECT_PROPERTY_PRIMARY_PHOTO_USE_CASE, useValue: composition.selectPropertyPrimaryPhoto ?? unavailableSelectPropertyPrimaryPhoto },
        { provide: DELETE_PROPERTY_PHOTO_USE_CASE, useValue: composition.deletePropertyPhoto ?? unavailableDeletePropertyPhoto },
        { provide: RETRIEVE_PROPERTY_PHOTO_STANDARD_USE_CASE, useValue: composition.retrievePropertyPhotoStandard ?? unavailableRetrievePropertyPhotoStandard },
        { provide: UPDATE_PROPERTY_PHOTO_STANDARD_USE_CASE, useValue: composition.updatePropertyPhotoStandard ?? unavailableUpdatePropertyPhotoStandard },
        { provide: RETRIEVE_PROPERTY_GEOLOCATION_USE_CASE, useValue: composition.retrievePropertyGeolocation ?? unavailableRetrievePropertyGeolocation },
        { provide: UPDATE_PROPERTY_GEOLOCATION_USE_CASE, useValue: composition.updatePropertyGeolocation ?? unavailableUpdatePropertyGeolocation },
        { provide: REMOVE_PROPERTY_GEOLOCATION_USE_CASE, useValue: composition.removePropertyGeolocation ?? unavailableRemovePropertyGeolocation },
        { provide: RETRIEVE_PROPERTY_AVAILABILITY_USE_CASE, useValue: composition.retrievePropertyAvailability ?? unavailableRetrievePropertyAvailability },
        { provide: UPDATE_PROPERTY_AVAILABILITY_USE_CASE, useValue: composition.updatePropertyAvailability ?? unavailableUpdatePropertyAvailability },
        { provide: PUBLIC_CATALOG_TENANT_RESOLVER, useValue: composition.publicCatalogTenantResolver ?? unavailablePublicCatalogTenantResolver },
        { provide: LIST_PUBLIC_PROPERTIES_USE_CASE, useValue: composition.listPublicProperties ?? unavailableListPublicProperties },
        { provide: RETRIEVE_PUBLIC_PROPERTY_USE_CASE, useValue: composition.retrievePublicProperty ?? unavailableRetrievePublicProperty },
        { provide: RETRIEVE_PUBLIC_PRIMARY_PHOTO_USE_CASE, useValue: composition.retrievePublicPrimaryPhoto ?? unavailableRetrievePublicPrimaryPhoto },
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
