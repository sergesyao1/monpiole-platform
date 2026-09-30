import {
  Organization,
  type OrganizationType,
} from "../domain/organization.js";
import {
  Tenant,
  normalizeTenantIntent,
  type NormalizedTenantIntent,
} from "../domain/tenant.js";
import type {
  Clock,
  IdentifierGenerator,
  PlatformAuthority,
  PlatformAuthorityAuthorizer,
  TenantCreatedRecord,
} from "./create-tenant.js";

export interface OrganizationProvisioningIntent {
  readonly type: OrganizationType;
  readonly legalName: string;
  readonly tradeName?: string;
  readonly registrationNumber: string;
  readonly taxIdentifier?: string;
  readonly phone: string;
  readonly email: string;
  readonly website?: string;
  readonly address: string;
  readonly city: string;
  readonly countryCode: string;
  readonly defaultLanguageCode: string;
  readonly defaultLocale: string;
  readonly defaultCurrencyCode: string;
  readonly defaultTimezone: string;
}

export interface ProvisionOrganizationTenantCommand {
  readonly authority: PlatformAuthority;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly tenant: NormalizedTenantIntent;
  readonly organization: OrganizationProvisioningIntent;
}

export interface ProvisionOrganizationTenantResult {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly lifecycleState: "PENDING";
  readonly createdAt: string;
}

export interface OrganizationTenantProvisioningIdempotencyRecord {
  readonly authorityId: string;
  readonly idempotencyKey: string;
  readonly normalizedIntent: string;
  readonly result: ProvisionOrganizationTenantResult;
  readonly correlationId: string;
  readonly actorId: string;
}

export interface OrganizationTenantProvisioningTrace {
  readonly correlationId: string;
  readonly actorId: string;
  readonly authorityId: string;
}

export interface ProvisionOrganizationTenantTransaction {
  acquireIdempotencyKey(
    authorityId: string,
    idempotencyKey: string,
  ): Promise<void>;

  findIdempotency(
    authorityId: string,
    idempotencyKey: string,
  ): Promise<OrganizationTenantProvisioningIdempotencyRecord | undefined>;

  findTenantByResponsibleEmail(
    email: string,
  ): Promise<Tenant | undefined>;

  insertTenant(
    tenant: Tenant,
    trace: OrganizationTenantProvisioningTrace,
  ): Promise<void>;

  insertOrganization(
    organization: Organization,
    trace: OrganizationTenantProvisioningTrace,
  ): Promise<void>;

  insertIdempotency(
    record: OrganizationTenantProvisioningIdempotencyRecord,
  ): Promise<void>;

  recordTenantCreated(
    event: TenantCreatedRecord,
  ): Promise<void>;
}

export interface ProvisionOrganizationTenantUnitOfWork {
  execute<Result>(
    operation: (
      transaction: ProvisionOrganizationTenantTransaction,
    ) => Promise<Result>,
  ): Promise<Result>;
}

export class OrganizationTenantProvisioningIdempotencyConflictError
  extends Error {
  readonly code =
    "ORGANIZATION_TENANT_PROVISIONING_IDEMPOTENCY_CONFLICT";

  constructor() {
    super(
      "The provisioning idempotency key is already associated with another intent.",
    );
  }
}

export class OrganizationTenantProvisioningIdempotencyWriteConflictError
  extends Error {
  readonly code =
    "ORGANIZATION_TENANT_PROVISIONING_IDEMPOTENCY_WRITE_CONFLICT";

  constructor() {
    super("The provisioning idempotency result could not be persisted.");
  }
}

export class OrganizationTenantProvisioningForbiddenError extends Error {
  readonly code = "ORGANIZATION_TENANT_PROVISIONING_FORBIDDEN";

  constructor() {
    super("The authority cannot provision an organization tenant.");
  }
}

export class DuplicateProvisioningTenantEmailError extends Error {
  readonly code = "DUPLICATE_PROVISIONING_TENANT_EMAIL";

  constructor() {
    super("A tenant already exists for the responsible email.");
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0
    ? undefined
    : normalized;
}

export function normalizeOrganizationProvisioningIntent(
  intent: OrganizationProvisioningIntent,
): OrganizationProvisioningIntent {
  const tradeName = normalizeOptional(intent.tradeName);
  const taxIdentifier = normalizeOptional(intent.taxIdentifier);
  const website = normalizeOptional(intent.website);

  return Object.freeze({
    type: intent.type,
    legalName: intent.legalName.trim(),
    ...(tradeName === undefined ? {} : { tradeName }),
    registrationNumber: intent.registrationNumber.trim(),
    ...(taxIdentifier === undefined ? {} : { taxIdentifier }),
    phone: intent.phone.trim(),
    email: intent.email.trim().toLowerCase(),
    ...(website === undefined ? {} : { website }),
    address: intent.address.trim(),
    city: intent.city.trim(),
    countryCode: intent.countryCode.trim().toUpperCase(),
    defaultLanguageCode: intent.defaultLanguageCode.trim().toLowerCase(),
    defaultLocale: intent.defaultLocale.trim(),
    defaultCurrencyCode: intent.defaultCurrencyCode.trim().toUpperCase(),
    defaultTimezone: intent.defaultTimezone.trim(),
  });
}

export function deterministicOrganizationTenantProvisioningIntent(
  tenant: NormalizedTenantIntent,
  organization: OrganizationProvisioningIntent,
): string {
  return JSON.stringify([
    tenant.organizationName,
    tenant.responsiblePersonName,
    tenant.responsibleEmail,
    tenant.responsibleTelephone,
    tenant.country,
    organization.type,
    organization.legalName,
    organization.tradeName ?? null,
    organization.registrationNumber,
    organization.taxIdentifier ?? null,
    organization.phone,
    organization.email,
    organization.website ?? null,
    organization.address,
    organization.city,
    organization.countryCode,
    organization.defaultLanguageCode,
    organization.defaultLocale,
    organization.defaultCurrencyCode,
    organization.defaultTimezone,
  ]);
}

export class ProvisionOrganizationTenant {
  constructor(
    private readonly authorizer: PlatformAuthorityAuthorizer,
    private readonly unitOfWork: ProvisionOrganizationTenantUnitOfWork,
    private readonly tenantIds: IdentifierGenerator,
    private readonly organizationIds: IdentifierGenerator,
    private readonly eventIds: IdentifierGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ProvisionOrganizationTenantCommand,
  ): Promise<ProvisionOrganizationTenantResult> {
    if (!await this.authorizer.authorizeCreateTenant(command.authority)) {
      throw new OrganizationTenantProvisioningForbiddenError();
    }

    const tenantIntent = normalizeTenantIntent(command.tenant);
    const organizationIntent =
      normalizeOrganizationProvisioningIntent(command.organization);

    const normalizedIntent =
      deterministicOrganizationTenantProvisioningIntent(
        tenantIntent,
        organizationIntent,
      );

    try {
      return await this.attempt(
        command,
        tenantIntent,
        organizationIntent,
        normalizedIntent,
      );
    } catch (error) {
      if (
        !(error instanceof
          OrganizationTenantProvisioningIdempotencyWriteConflictError)
      ) {
        throw error;
      }

      return this.unitOfWork.execute(async (transaction) => {
        const existing = await transaction.findIdempotency(
          command.authority.authorityId,
          command.idempotencyKey,
        );

        if (
          existing === undefined ||
          existing.normalizedIntent !== normalizedIntent
        ) {
          throw new OrganizationTenantProvisioningIdempotencyConflictError();
        }

        return existing.result;
      });
    }
  }

  private attempt(
    command: ProvisionOrganizationTenantCommand,
    tenantIntent: NormalizedTenantIntent,
    organizationIntent: OrganizationProvisioningIntent,
    normalizedIntent: string,
  ): Promise<ProvisionOrganizationTenantResult> {
    return this.unitOfWork.execute(async (transaction) => {
      await transaction.acquireIdempotencyKey(
        command.authority.authorityId,
        command.idempotencyKey,
      );

      const existing = await transaction.findIdempotency(
        command.authority.authorityId,
        command.idempotencyKey,
      );

      if (existing !== undefined) {
        if (existing.normalizedIntent !== normalizedIntent) {
          throw new OrganizationTenantProvisioningIdempotencyConflictError();
        }

        return existing.result;
      }

      if (
        await transaction.findTenantByResponsibleEmail(
          tenantIntent.responsibleEmail,
        )
      ) {
        throw new DuplicateProvisioningTenantEmailError();
      }

      const createdAt = this.clock.now();
      const tenantId = this.tenantIds.generate();
      const organizationId = this.organizationIds.generate();

      const tenant = Tenant.create({
        id: tenantId,
        ...tenantIntent,
        createdAt,
      });

      const organization = Organization.create({
        id: organizationId,
        tenantId,
        ...organizationIntent,
        createdAt,
        updatedAt: createdAt,
      });

      const result = Object.freeze({
        tenantId,
        organizationId,
        lifecycleState: "PENDING" as const,
        createdAt,
      });

      const trace = {
        correlationId: command.correlationId,
        actorId: command.authority.actorId,
        authorityId: command.authority.authorityId,
      };

      await transaction.insertTenant(tenant, trace);
      await transaction.insertOrganization(organization, trace);

      await transaction.insertIdempotency({
        authorityId: command.authority.authorityId,
        idempotencyKey: command.idempotencyKey,
        normalizedIntent,
        result,
        correlationId: command.correlationId,
        actorId: command.authority.actorId,
      });

      await transaction.recordTenantCreated({
        eventId: this.eventIds.generate(),
        tenantId,
        correlationId: command.correlationId,
        occurredAt: createdAt,
        lifecycleState: "PENDING",
      });

      return result;
    });
  }
}
