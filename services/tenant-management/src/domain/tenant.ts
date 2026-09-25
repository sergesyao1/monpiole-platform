const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const E164 = /^\+[1-9][0-9]{1,14}$/;
const COUNTRY = /^[A-Z]{2}$/;

export type TenantLifecycleState = "PENDING" | "ACTIVE";

export interface CreateTenantValues {
  readonly id: string;
  readonly organizationName: string;
  readonly responsiblePersonName: string;
  readonly responsibleEmail: string;
  readonly responsibleTelephone: string;
  readonly country: string;
  readonly createdAt: string;
}

export interface ReconstituteTenantValues extends CreateTenantValues {
  readonly lifecycleState: TenantLifecycleState;
  readonly activatedAt?: string;
}

export interface NormalizedTenantIntent {
  readonly organizationName: string;
  readonly responsiblePersonName: string;
  readonly responsibleEmail: string;
  readonly responsibleTelephone: string;
  readonly country: string;
}

export class InvalidTenantInputError extends Error {
  readonly code = "INVALID_TENANT_INPUT";
  constructor(readonly field: keyof NormalizedTenantIntent | "id" | "createdAt" | "activatedAt") {
    super(`Invalid tenant ${field}`);
    this.name = "InvalidTenantInputError";
  }
}

export function normalizeTenantIntent(input: NormalizedTenantIntent): NormalizedTenantIntent {
  const organizationName = input.organizationName.trim();
  const responsiblePersonName = input.responsiblePersonName.trim();
  const responsibleEmail = input.responsibleEmail.trim().toLowerCase();
  if (organizationName.length === 0) throw new InvalidTenantInputError("organizationName");
  if (responsiblePersonName.length === 0) throw new InvalidTenantInputError("responsiblePersonName");
  if (responsibleEmail.length === 0) throw new InvalidTenantInputError("responsibleEmail");
  if (!E164.test(input.responsibleTelephone)) throw new InvalidTenantInputError("responsibleTelephone");
  if (!COUNTRY.test(input.country)) throw new InvalidTenantInputError("country");
  return Object.freeze({
    organizationName,
    responsiblePersonName,
    responsibleEmail,
    responsibleTelephone: input.responsibleTelephone,
    country: input.country,
  });
}

export class Tenant {
  private constructor(
    readonly values: Readonly<CreateTenantValues>,
    readonly lifecycleState: TenantLifecycleState,
    readonly activatedAt?: string,
  ) {}

  static create(values: CreateTenantValues): Tenant {
    if (!UUID_V4.test(values.id)) throw new InvalidTenantInputError("id");
    const normalized = normalizeTenantIntent(values);
    if (!Number.isFinite(Date.parse(values.createdAt)) || !values.createdAt.endsWith("Z")) {
      throw new InvalidTenantInputError("createdAt");
    }
    return new Tenant(Object.freeze({ ...normalized, id: values.id, createdAt: values.createdAt }), "PENDING");
  }

  static reconstitute(values: ReconstituteTenantValues): Tenant {
    const tenant = Tenant.create(values);
    if (values.lifecycleState === "PENDING") return tenant;
    if (values.activatedAt === undefined || !validTimestamp(values.activatedAt)) {
      throw new InvalidTenantInputError("activatedAt");
    }
    return new Tenant(tenant.values, "ACTIVE", values.activatedAt);
  }

  activate(activatedAt: string): Tenant {
    if (this.lifecycleState === "ACTIVE") return this;
    if (!validTimestamp(activatedAt)) throw new InvalidTenantInputError("activatedAt");
    return new Tenant(this.values, "ACTIVE", activatedAt);
  }
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && value.endsWith("Z");
}
