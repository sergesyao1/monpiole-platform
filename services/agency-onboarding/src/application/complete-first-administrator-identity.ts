import type {
  FirstAdministratorBootstrap,
  FirstAdministratorBootstrapUnitOfWork,
} from "./first-administrator-persistence.js";
import type {
  FirstAdministratorBootstrapClock,
  FirstAdministratorBootstrapTokenHasher,
} from "./first-administrator-bootstrap.js";

export interface LinkFirstAdministratorExternalIdentityInput {
  readonly issuer: string;
  readonly subject: string;
  readonly internalIdentityId: string;
  readonly tenantId: string;
  readonly createdAt: string;
}

export interface LinkedFirstAdministratorExternalIdentity {
  readonly issuer: string;
  readonly subject: string;
}

export interface FirstAdministratorExternalIdentityLinkPort {
  /**
   * Canonicalizes external identity provenance through the Identity domain
   * without persisting an external association.
   */
  canonicalize(
    input: LinkFirstAdministratorExternalIdentityInput,
  ): LinkedFirstAdministratorExternalIdentity;

  /**
   * Must converge when the same external identity is linked again to the same
   * internal identity and tenant.
   *
   * Returns the canonical external identity provenance accepted by Identity.
   * A pre-existing link to another internal identity or tenant is a conflict.
   */
  link(
    input: LinkFirstAdministratorExternalIdentityInput,
  ): Promise<LinkedFirstAdministratorExternalIdentity>;
}

export interface CompleteFirstAdministratorIdentityCommand {
  readonly bootstrapToken: string;
  readonly issuer: string;
  readonly subject: string;
}

export interface CompleteFirstAdministratorIdentityResult {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly administratorId: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "IDENTITY_LINKED";
  readonly identityLinkedAt: string;
}

export class FirstAdministratorBootstrapTokenNotFoundError extends Error {
  public readonly code = "FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_NOT_FOUND";

  public constructor() {
    super("First administrator bootstrap token was not found");
    this.name = "FirstAdministratorBootstrapTokenNotFoundError";
  }
}

export class FirstAdministratorBootstrapTokenExpiredError extends Error {
  public readonly code = "FIRST_ADMINISTRATOR_BOOTSTRAP_TOKEN_EXPIRED";

  public constructor() {
    super("First administrator bootstrap token has expired");
    this.name = "FirstAdministratorBootstrapTokenExpiredError";
  }
}

export class FirstAdministratorBootstrapNotCompletableError extends Error {
  public readonly code = "FIRST_ADMINISTRATOR_BOOTSTRAP_NOT_COMPLETABLE";

  public constructor(
    public readonly status: FirstAdministratorBootstrap["status"],
  ) {
    super(
      `First administrator bootstrap cannot be completed from status ${status}`,
    );
    this.name = "FirstAdministratorBootstrapNotCompletableError";
  }
}

export class FirstAdministratorIdentityLinkConflictError extends Error {
  public readonly code = "FIRST_ADMINISTRATOR_IDENTITY_LINK_CONFLICT";

  public constructor() {
    super("First administrator external identity conflicts with the bootstrap");
    this.name = "FirstAdministratorIdentityLinkConflictError";
  }
}

/**
 * Completes the external identity association for the already provisioned
 * first agency administrator.
 *
 * The Agency Onboarding transaction keeps the bootstrap row locked from the
 * validation through the Identity association and the local state transition.
 * This serializes concurrent uses of the same bootstrap token.
 *
 * Identity still commits independently. This is deliberately not a
 * distributed transaction: if Identity commits and Agency Onboarding later
 * rolls back, an identical retry converges through the Identity link port.
 */
export class CompleteFirstAdministratorIdentity {
  public constructor(
    private readonly unitOfWork: FirstAdministratorBootstrapUnitOfWork,
    private readonly tokenHasher: FirstAdministratorBootstrapTokenHasher,
    private readonly clock: FirstAdministratorBootstrapClock,
    private readonly identities: FirstAdministratorExternalIdentityLinkPort,
  ) {}

  public async execute(
    command: CompleteFirstAdministratorIdentityCommand,
  ): Promise<CompleteFirstAdministratorIdentityResult> {
    const bootstrapTokenHash = this.tokenHasher.hash(command.bootstrapToken);
    const now = this.clock.now();

    const completed = await this.unitOfWork.execute(async (transaction) => {
      const administrator =
        await transaction.findAdministratorByBootstrapTokenHashForUpdate(
          bootstrapTokenHash,
        );

      if (administrator === undefined) {
        throw new FirstAdministratorBootstrapTokenNotFoundError();
      }

      if (administrator.status === "IDENTITY_LINKED") {
        const canonicalIdentity = this.identities.canonicalize({
          issuer: command.issuer,
          subject: command.subject,
          internalIdentityId: administrator.internalIdentityId,
          tenantId: administrator.tenantId,
          createdAt: now,
        });

        if (
          administrator.externalIssuer === undefined ||
          administrator.externalSubject === undefined ||
          administrator.externalIssuer !== canonicalIdentity.issuer ||
          administrator.externalSubject !== canonicalIdentity.subject
        ) {
          throw new FirstAdministratorIdentityLinkConflictError();
        }

        return administrator;
      }

      if (administrator.status !== "PENDING_IDENTITY") {
        throw new FirstAdministratorBootstrapNotCompletableError(
          administrator.status,
        );
      }

      if (administrator.bootstrapTokenConsumedAt !== undefined) {
        throw new FirstAdministratorBootstrapNotCompletableError(
          administrator.status,
        );
      }

      if (
        new Date(administrator.bootstrapTokenExpiresAt).valueOf() <=
        new Date(now).valueOf()
      ) {
        throw new FirstAdministratorBootstrapTokenExpiredError();
      }

      const canonicalIdentity = await this.identities.link({
        issuer: command.issuer,
        subject: command.subject,
        internalIdentityId: administrator.internalIdentityId,
        tenantId: administrator.tenantId,
        createdAt: now,
      });

      const linked =
        await transaction.markAdministratorIdentityLinked(
          bootstrapTokenHash,
          administrator.internalIdentityId,
          canonicalIdentity.issuer,
          canonicalIdentity.subject,
          now,
          now,
        );

      if (linked === undefined) {
        throw new FirstAdministratorIdentityLinkConflictError();
      }

      return linked;
    });

    return toResult(completed);
  }
}

function toResult(
  administrator: FirstAdministratorBootstrap,
): CompleteFirstAdministratorIdentityResult {
  if (
    administrator.status !== "IDENTITY_LINKED" ||
    administrator.identityLinkedAt === undefined
  ) {
    throw new FirstAdministratorIdentityLinkConflictError();
  }

  return {
    registrationId: administrator.registrationId,
    tenantId: administrator.tenantId,
    administratorId: administrator.internalIdentityId,
    role: "TENANT_ADMINISTRATOR",
    status: "IDENTITY_LINKED",
    identityLinkedAt: administrator.identityLinkedAt,
  };
}