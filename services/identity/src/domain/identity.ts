const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type TenantRole = "TENANT_ADMINISTRATOR";
export type IdentityStatus = "PENDING_ACTIVATION" | "ACTIVE";
export type PendingIdentity = Identity & { readonly status: "PENDING_ACTIVATION" };
export type ActiveIdentity = Identity & { readonly status: "ACTIVE" };

export class InvalidBootstrapAdministratorError extends Error {
  readonly code = "INVALID_BOOTSTRAP_ADMINISTRATOR";
  constructor(readonly field: "tenantId" | "administratorId" | "email" | "firstName" | "lastName") {
    super(`Invalid bootstrap administrator ${field}`);
    this.name = "InvalidBootstrapAdministratorError";
  }
}

export function normalizeAdministratorEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) throw new InvalidBootstrapAdministratorError("email");
  return normalized;
}

export class Identity {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly firstName: string,
    readonly lastName: string,
    readonly status: IdentityStatus,
  ) {}

  static bootstrap(values: { id: string; email: string; firstName: string; lastName: string }): PendingIdentity {
    if (!UUID_V4.test(values.id)) throw new InvalidBootstrapAdministratorError("administratorId");
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    if (firstName.length === 0) throw new InvalidBootstrapAdministratorError("firstName");
    if (lastName.length === 0) throw new InvalidBootstrapAdministratorError("lastName");
    return new Identity(
      values.id, normalizeAdministratorEmail(values.email), firstName, lastName, "PENDING_ACTIVATION",
    ) as PendingIdentity;
  }

  activate(): ActiveIdentity {
    if (this.status === "ACTIVE") return this as ActiveIdentity;
    return new Identity(this.id, this.email, this.firstName, this.lastName, "ACTIVE") as ActiveIdentity;
  }
}

export class TenantMembership {
  readonly role = "TENANT_ADMINISTRATOR" as const;
  private constructor(readonly tenantId: string, readonly identityId: string) {}
  static bootstrap(tenantId: string, identityId: string): TenantMembership {
    if (!UUID_V4.test(tenantId)) throw new InvalidBootstrapAdministratorError("tenantId");
    if (!UUID_V4.test(identityId)) throw new InvalidBootstrapAdministratorError("administratorId");
    return new TenantMembership(tenantId, identityId);
  }
}
