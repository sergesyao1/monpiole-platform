import { randomUUID } from "node:crypto";

import {
  ActivateTenantAdministrator,
  BootstrapTenantAdministrator,
  HasActiveTenantAdministrator,
  PostgresIdentityStore,
  PostgresExternalIdentityStore,
} from "@monpiole/identity";
import { PostgresPool, postgresConfigurationFromEnvironment } from "@monpiole/persistence";
import {
  CreateProperty, CreatePropertyOwner, ListProperties, ListPropertyOwners, PostgresPropertyOwnerDirectoryQuery,
  PostgresPropertyOwnerRepository, PostgresPropertyPortfolioQuery, PostgresPropertyRepository,
  RetrieveProperty, RetrievePropertyOwner, SetPropertyPricing, UpdatePropertyCoreInformation, UpdatePropertyDetails, UpdatePropertyOwner,
  AssignPropertyOwner, PostgresPropertyOwnershipRepository, RetrievePropertyOwnerships, RemovePropertyOwner,
  CreatePropertyBuilding, ListPropertyBuildings, UpdatePropertyBuilding, CreatePropertyUnit, ListPropertyUnits, UpdatePropertyUnitStructure, PostgresPropertyCompositionRepository,
  PublishProperty, WithdrawPropertyFromCatalog,
  PostgresPropertyPhotoRepository, RegisterPropertyPhoto, RetrievePropertyPhotoContent,
  ListPropertyPhotos, SelectPropertyPrimaryPhoto, DeletePropertyPhoto, ReorderPropertyPhotos,
  PostgresPropertyPhotoStandardRepository, RetrievePropertyPhotoStandard, UpdatePropertyPhotoStandard,
  ListPublicProperties, RetrievePublicProperty, RetrievePublicPrimaryPhoto, RetrievePublicPropertyMedia, PostgresPublicPropertyCatalogQuery,
  PostgresPropertyGeolocationRepository, RetrievePropertyGeolocation,
  UpdatePropertyGeolocation, RemovePropertyGeolocation,
  PostgresPropertyAmenityRepository, RetrieveAmenityCatalog, RetrievePropertyAmenities, ReplacePropertyAmenities,
  PostgresPropertyAvailabilityQuery, RetrievePropertyAvailability, UpdatePropertyAvailability,
  PostgresPropertyClientRepository, CreatePropertyClient, ListPropertyClients, RetrievePropertyClient,
  PostgresPropertyContractRepository, CreatePropertyContract, ListPropertyContracts, RetrievePropertyContract,
  UpdatePropertyContract, ActivatePropertyContract, EndPropertyContract, CancelPropertyContract,
  PostgresPropertyWorkspaceSummaryQuery, RetrievePropertyWorkspace,
  PostgresPropertyInquiryRepository, SubmitPublicPropertyInquiry, ListPropertyInquiries, RetrievePropertyInquiry, AcknowledgePropertyInquiry, ClosePropertyInquiry,
  PostgresPropertyViewingRepository, SchedulePropertyViewing, RetrieveInquiryViewing, RetrievePropertyViewing, ReschedulePropertyViewing, CompletePropertyViewing, CancelPropertyViewing,
  PostgresPropertyViewingOutcomeRepository, CreatePropertyViewingOutcome, RetrievePropertyViewingOutcome, ProceedPropertyViewingOutcome, DeclinePropertyViewingOutcome,
  PostgresPropertyApplicationRepository, CreatePropertyApplication, RetrieveViewingPropertyApplication, ListPropertyApplications, RetrievePropertyApplication, ApprovePropertyApplication, RejectPropertyApplication, WithdrawPropertyApplication,
  PostgresPropertyApplicationClientConversionRepository, ConvertPropertyApplicationToClient, RetrievePropertyApplicationClientConversion,
} from "@monpiole/property-management";
import {
  ActivateTenant,
  CheckTenantExists,
  CreateTenant,
  PostgresActivateTenantUnitOfWork,
  PostgresCreateTenantUnitOfWork,
  PostgresTenantExistenceRepository,
} from "@monpiole/tenant-management";

import type { ApiComposition } from "../app.module.js";
import { IdentityActiveTenantAdministratorAdapter } from "./identity-active-tenant-administrator.adapter.js";
import { TenantExistenceAdapter } from "./tenant-existence.adapter.js";
import { OnboardingAuthorityPolicy } from "./onboarding-authority-policy.js";
import { OidcAccessTokenVerifier, oidcAccessTokenConfigurationFromEnvironment } from "../authentication/oidc-access-token-verifier.js";
import { OidcAuthenticatedAuthorityProvider } from "../authentication/oidc-authenticated-authority-provider.js";
import { IdentityExternalAuthorityAdapter } from "./identity-external-authority.adapter.js";
import { publicCatalogHostAllowlistFromEnvironment } from "../configuration/public-catalog.js";

export interface PostgresApiRuntime {
  readonly composition: ApiComposition;
  readonly identityStore: PostgresIdentityStore;
  readonly externalIdentityStore: PostgresExternalIdentityStore;
  close(): Promise<void>;
}

export interface PostgresApiRuntimeDependencies {
  readonly accessTokenVerifier?: Pick<OidcAccessTokenVerifier, "verify">;
}

export function createPostgresApiRuntime(
  environment: NodeJS.ProcessEnv,
  dependencies: PostgresApiRuntimeDependencies = {},
): PostgresApiRuntime {
  const accessTokenVerifier = dependencies.accessTokenVerifier
    ?? new OidcAccessTokenVerifier(oidcAccessTokenConfigurationFromEnvironment(environment));
  const database = new PostgresPool(postgresConfigurationFromEnvironment(environment));
  const publicCatalogAllowlist = publicCatalogHostAllowlistFromEnvironment(environment);
  const publicCatalogDatabase = publicCatalogAllowlist.size === 0
    ? undefined
    : new PostgresPool(publicCatalogPostgresConfigurationFromEnvironment(environment));
  const pool = database.infrastructurePool();
  const identityStore = new PostgresIdentityStore(pool);
  const externalIdentityStore = new PostgresExternalIdentityStore(pool);
  const authenticatedAuthorityProvider = new OidcAuthenticatedAuthorityProvider(
    accessTokenVerifier,
    new IdentityExternalAuthorityAdapter(externalIdentityStore),
  );
  const activeAdministrator = new HasActiveTenantAdministrator(identityStore);
  const tenantExists = new CheckTenantExists(new PostgresTenantExistenceRepository(pool));
  const authorityPolicy = new OnboardingAuthorityPolicy();
  const propertyRepository = new PostgresPropertyRepository(pool);
  const propertyPhotoRepository = new PostgresPropertyPhotoRepository(pool);
  const propertyPhotoStandardRepository = new PostgresPropertyPhotoStandardRepository(pool);
  const propertyOwnerRepository = new PostgresPropertyOwnerRepository(pool);
  const propertyOwnershipRepository = new PostgresPropertyOwnershipRepository(pool);
  const propertyCompositionRepository = new PostgresPropertyCompositionRepository(pool);
  const propertyGeolocationRepository = new PostgresPropertyGeolocationRepository(pool);
  const propertyAmenityRepository = new PostgresPropertyAmenityRepository(pool);
  const propertyAvailabilityQuery = new PostgresPropertyAvailabilityQuery(pool);
  const propertyClientRepository = new PostgresPropertyClientRepository(pool);
  const propertyContractRepository = new PostgresPropertyContractRepository(pool);
  const propertyInquiryRepository = new PostgresPropertyInquiryRepository(pool);
  const propertyViewingRepository = new PostgresPropertyViewingRepository(pool);
  const propertyViewingOutcomeRepository = new PostgresPropertyViewingOutcomeRepository(pool);
  const propertyApplicationRepository = new PostgresPropertyApplicationRepository(pool);
  const propertyApplicationClientConversionRepository = new PostgresPropertyApplicationClientConversionRepository(pool);
  const compositionClock = { now: () => new Date().toISOString() };
  const publicCatalogQuery = publicCatalogDatabase === undefined
    ? undefined
    : new PostgresPublicPropertyCatalogQuery(publicCatalogDatabase.infrastructurePool());

  const composition: ApiComposition = {
    authenticatedAuthorityProvider,
    platformAuthorityAuthorizer: authorityPolicy,
    createTenant: new CreateTenant(
      authorityPolicy,
      new PostgresCreateTenantUnitOfWork(pool),
      { generate: randomUUID }, { generate: randomUUID }, { now: () => new Date().toISOString() },
    ),
    bootstrapTenantAdministrator: new BootstrapTenantAdministrator(
      new TenantExistenceAdapter(tenantExists), identityStore, { generate: randomUUID }, authorityPolicy,
    ),
    activateTenantAdministrator: new ActivateTenantAdministrator(identityStore, authorityPolicy),
    activateTenant: new ActivateTenant(
      new PostgresActivateTenantUnitOfWork(pool),
      new IdentityActiveTenantAdministratorAdapter(activeAdministrator),
      { generate: randomUUID }, { now: () => new Date().toISOString() },
      authorityPolicy,
    ),
    createProperty: new CreateProperty(propertyRepository, { generate: randomUUID }, { now: () => new Date().toISOString() }),
    retrieveProperty: new RetrieveProperty(propertyRepository),
    listProperties: new ListProperties(new PostgresPropertyPortfolioQuery(pool)),
    updatePropertyDetails: new UpdatePropertyDetails(propertyRepository, { now: () => new Date().toISOString() }),
    setPropertyPricing: new SetPropertyPricing(propertyRepository, { now: () => new Date().toISOString() }),
    updatePropertyCoreInformation: new UpdatePropertyCoreInformation(propertyRepository, { now: () => new Date().toISOString() }),
    publishProperty: new PublishProperty(propertyRepository, { now: () => new Date().toISOString() }),
    withdrawPropertyFromCatalog: new WithdrawPropertyFromCatalog(propertyRepository, { now: () => new Date().toISOString() }),
    listPropertyPhotos: new ListPropertyPhotos(propertyPhotoRepository),
    registerPropertyPhoto: new RegisterPropertyPhoto(propertyPhotoRepository, { generate: randomUUID }, { now: () => new Date().toISOString() }),
    retrievePropertyPhotoContent: new RetrievePropertyPhotoContent(propertyPhotoRepository),
    selectPropertyPrimaryPhoto: new SelectPropertyPrimaryPhoto(propertyPhotoRepository, { now: () => new Date().toISOString() }),
    deletePropertyPhoto: new DeletePropertyPhoto(propertyPhotoRepository),
    reorderPropertyPhotos: new ReorderPropertyPhotos(propertyPhotoRepository),
    retrievePropertyPhotoStandard: new RetrievePropertyPhotoStandard(propertyPhotoStandardRepository),
    updatePropertyPhotoStandard: new UpdatePropertyPhotoStandard(propertyPhotoStandardRepository, { now: () => new Date().toISOString() }),
    retrievePropertyGeolocation: new RetrievePropertyGeolocation(propertyGeolocationRepository),
    updatePropertyGeolocation: new UpdatePropertyGeolocation(propertyGeolocationRepository, { now: () => new Date().toISOString() }),
    removePropertyGeolocation: new RemovePropertyGeolocation(propertyGeolocationRepository),
    retrieveAmenityCatalog: new RetrieveAmenityCatalog(),
    retrievePropertyAmenities: new RetrievePropertyAmenities(propertyAmenityRepository),
    replacePropertyAmenities: new ReplacePropertyAmenities(propertyAmenityRepository, compositionClock),
    submitPublicPropertyInquiry: new SubmitPublicPropertyInquiry(propertyInquiryRepository, { generate: randomUUID }, compositionClock),
    listPropertyInquiries: new ListPropertyInquiries(propertyInquiryRepository),
    retrievePropertyInquiry: new RetrievePropertyInquiry(propertyInquiryRepository),
    acknowledgePropertyInquiry: new AcknowledgePropertyInquiry(propertyInquiryRepository, compositionClock),
    closePropertyInquiry: new ClosePropertyInquiry(propertyInquiryRepository, compositionClock),
    schedulePropertyViewing: new SchedulePropertyViewing(propertyInquiryRepository, propertyViewingRepository, { generate: randomUUID }, compositionClock),
    retrieveInquiryViewing: new RetrieveInquiryViewing(propertyViewingRepository),
    retrievePropertyViewing: new RetrievePropertyViewing(propertyViewingRepository),
    reschedulePropertyViewing: new ReschedulePropertyViewing(propertyViewingRepository, compositionClock),
    completePropertyViewing: new CompletePropertyViewing(propertyViewingRepository, compositionClock),
    cancelPropertyViewing: new CancelPropertyViewing(propertyViewingRepository, compositionClock),
    createPropertyViewingOutcome: new CreatePropertyViewingOutcome(propertyViewingOutcomeRepository, { generate: randomUUID }, compositionClock),
    retrievePropertyViewingOutcome: new RetrievePropertyViewingOutcome(propertyViewingOutcomeRepository),
    proceedPropertyViewingOutcome: new ProceedPropertyViewingOutcome(propertyViewingOutcomeRepository, compositionClock),
    declinePropertyViewingOutcome: new DeclinePropertyViewingOutcome(propertyViewingOutcomeRepository, compositionClock),
    createPropertyApplication: new CreatePropertyApplication(propertyApplicationRepository, { generate: randomUUID }, compositionClock),
    retrieveViewingPropertyApplication: new RetrieveViewingPropertyApplication(propertyApplicationRepository),
    listPropertyApplications: new ListPropertyApplications(propertyApplicationRepository),
    retrievePropertyApplication: new RetrievePropertyApplication(propertyApplicationRepository),
    approvePropertyApplication: new ApprovePropertyApplication(propertyApplicationRepository, compositionClock),
    rejectPropertyApplication: new RejectPropertyApplication(propertyApplicationRepository, compositionClock),
    withdrawPropertyApplication: new WithdrawPropertyApplication(propertyApplicationRepository, compositionClock),
    convertPropertyApplicationToClient: new ConvertPropertyApplicationToClient(propertyApplicationClientConversionRepository, { generate: randomUUID }, compositionClock),
    retrievePropertyApplicationClientConversion: new RetrievePropertyApplicationClientConversion(propertyApplicationClientConversionRepository),
    retrievePropertyAvailability: new RetrievePropertyAvailability(propertyAvailabilityQuery),
    updatePropertyAvailability: new UpdatePropertyAvailability(propertyRepository, { now: () => new Date().toISOString() }),
    createPropertyClient: new CreatePropertyClient(propertyClientRepository, { generate: randomUUID }, compositionClock),
    listPropertyClients: new ListPropertyClients(propertyClientRepository),
    retrievePropertyClient: new RetrievePropertyClient(propertyClientRepository),
    createPropertyContract: new CreatePropertyContract(
      propertyContractRepository, propertyClientRepository, propertyRepository, { generate: randomUUID }, compositionClock,
    ),
    listPropertyContracts: new ListPropertyContracts(propertyContractRepository),
    retrievePropertyContract: new RetrievePropertyContract(propertyContractRepository),
    updatePropertyContract: new UpdatePropertyContract(
      propertyContractRepository, propertyClientRepository, propertyRepository, compositionClock,
    ),
    activatePropertyContract: new ActivatePropertyContract(propertyContractRepository, compositionClock),
    endPropertyContract: new EndPropertyContract(propertyContractRepository, compositionClock),
    cancelPropertyContract: new CancelPropertyContract(propertyContractRepository, compositionClock),
    retrievePropertyWorkspace: new RetrievePropertyWorkspace(
      propertyRepository, propertyAvailabilityQuery, propertyPhotoStandardRepository,
      new PostgresPropertyWorkspaceSummaryQuery(pool),
    ),
    publicCatalogTenantResolver: publicCatalogAllowlist.resolver,
    ...(publicCatalogQuery === undefined ? {} : {
      listPublicProperties: new ListPublicProperties(publicCatalogQuery),
      retrievePublicProperty: new RetrievePublicProperty(publicCatalogQuery),
      retrievePublicPrimaryPhoto: new RetrievePublicPrimaryPhoto(publicCatalogQuery),
      retrievePublicPropertyMedia: new RetrievePublicPropertyMedia(publicCatalogQuery),
    }),
    createPropertyOwner: new CreatePropertyOwner(propertyOwnerRepository, { generate: randomUUID }, { now: () => new Date().toISOString() }),
    retrievePropertyOwner: new RetrievePropertyOwner(propertyOwnerRepository),
    listPropertyOwners: new ListPropertyOwners(new PostgresPropertyOwnerDirectoryQuery(pool)),
    updatePropertyOwner: new UpdatePropertyOwner(propertyOwnerRepository, { now: () => new Date().toISOString() }),
    assignPropertyOwner: new AssignPropertyOwner(propertyOwnershipRepository, { now: () => new Date().toISOString() }),
    retrievePropertyOwnerships: new RetrievePropertyOwnerships(propertyOwnershipRepository),
    removePropertyOwner: new RemovePropertyOwner(propertyOwnershipRepository),
    createPropertyBuilding: new CreatePropertyBuilding(propertyRepository, propertyCompositionRepository, { generate: randomUUID }, compositionClock),
    listPropertyBuildings: new ListPropertyBuildings(propertyCompositionRepository), updatePropertyBuilding: new UpdatePropertyBuilding(propertyCompositionRepository, compositionClock),
    createPropertyUnit: new CreatePropertyUnit(propertyCompositionRepository, { generate: randomUUID }, compositionClock),
    listPropertyUnits: new ListPropertyUnits(propertyCompositionRepository), updatePropertyUnitStructure: new UpdatePropertyUnitStructure(propertyCompositionRepository, compositionClock),
    runtimeShutdown: { onApplicationShutdown: () => closeDatabases(database, publicCatalogDatabase) },
  };

  return { composition, identityStore, externalIdentityStore, close: () => closeDatabases(database, publicCatalogDatabase) };
}

function publicCatalogPostgresConfigurationFromEnvironment(environment: NodeJS.ProcessEnv) {
  const remapped: NodeJS.ProcessEnv = {
    ...environment,
    DATABASE_URL: environment["PUBLIC_CATALOG_DATABASE_URL"],
    DATABASE_TLS: environment["PUBLIC_CATALOG_DATABASE_TLS"],
    DATABASE_POOL_MAX: environment["PUBLIC_CATALOG_DATABASE_POOL_MAX"],
    DATABASE_CONNECTION_TIMEOUT_MS: environment["PUBLIC_CATALOG_DATABASE_CONNECTION_TIMEOUT_MS"],
    DATABASE_IDLE_TIMEOUT_MS: environment["PUBLIC_CATALOG_DATABASE_IDLE_TIMEOUT_MS"],
  };
  const configuration = postgresConfigurationFromEnvironment(remapped);
  let username: string;
  try {
    username = decodeURIComponent(new URL(configuration.connectionString).username);
  } catch {
    throw new Error("PUBLIC_CATALOG_DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (username !== "monpiole_public_catalog_reader") {
    throw new Error("PUBLIC_CATALOG_DATABASE_URL must use the monpiole_public_catalog_reader role");
  }
  return configuration;
}

async function closeDatabases(privateDatabase: PostgresPool, publicCatalogDatabase: PostgresPool | undefined): Promise<void> {
  await publicCatalogDatabase?.close();
  await privateDatabase.close();
}
