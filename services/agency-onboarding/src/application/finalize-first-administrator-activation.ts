import type {
  FirstAdministratorBootstrap,
  FirstAdministratorBootstrapUnitOfWork,
} from "./first-administrator-persistence.js";
import type {
  FirstAdministratorBootstrapClock,
} from "./first-administrator-bootstrap.js";

export interface FinalizeFirstAdministratorActivationCommand {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly administratorId: string;
}

export interface FinalizeFirstAdministratorActivationResult {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly administratorId: string;
  readonly role: "TENANT_ADMINISTRATOR";
  readonly status: "ACTIVE";
  readonly activatedAt: string;
}

export class FirstAdministratorActivationNotFoundError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_ACTIVATION_NOT_FOUND";

  constructor() {
    super("First administrator bootstrap was not found");
    this.name = "FirstAdministratorActivationNotFoundError";
  }
}

export class FirstAdministratorActivationNotReadyError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_ACTIVATION_NOT_READY";

  constructor() {
    super("First administrator bootstrap is not ready for activation");
    this.name = "FirstAdministratorActivationNotReadyError";
  }
}

export class FirstAdministratorActivationConflictError extends Error {
  readonly code = "FIRST_ADMINISTRATOR_ACTIVATION_CONFLICT";

  constructor() {
    super("First administrator bootstrap does not match the activation coordinates");
    this.name = "FirstAdministratorActivationConflictError";
  }
}

export class FinalizeFirstAdministratorActivation {
  constructor(
    private readonly unitOfWork: FirstAdministratorBootstrapUnitOfWork,
    private readonly clock: FirstAdministratorBootstrapClock,
  ) {}

  async execute(
    command: FinalizeFirstAdministratorActivationCommand,
  ): Promise<FinalizeFirstAdministratorActivationResult> {
    return this.unitOfWork.execute(async (transaction) => {
      const existing =
        await transaction.findAdministratorByRegistration(
          command.registrationId,
        );

      if (existing === undefined) {
        throw new FirstAdministratorActivationNotFoundError();
      }

      this.assertCoordinates(existing, command);

      if (existing.status === "ACTIVE") {
        return this.toResult(existing);
      }

      if (existing.status !== "IDENTITY_LINKED") {
        throw new FirstAdministratorActivationNotReadyError();
      }

      const activatedAt = this.clock.now();

      const activated = await transaction.markAdministratorActive(
        command.registrationId,
        command.tenantId,
        command.administratorId,
        activatedAt,
      );

      if (activated !== undefined) {
        return this.toResult(activated);
      }

      /*
       * The compare-and-set may legitimately lose a concurrent race.
       * Re-read the canonical row and converge if another transaction
       * already completed the activation.
       */
      const canonical =
        await transaction.findAdministratorByRegistration(
          command.registrationId,
        );

      if (canonical === undefined) {
        throw new FirstAdministratorActivationNotFoundError();
      }

      this.assertCoordinates(canonical, command);

      if (canonical.status !== "ACTIVE") {
        throw new FirstAdministratorActivationNotReadyError();
      }

      return this.toResult(canonical);
    });
  }

  private assertCoordinates(
    administrator: FirstAdministratorBootstrap,
    command: FinalizeFirstAdministratorActivationCommand,
  ): void {
    if (
      administrator.tenantId !== command.tenantId ||
      administrator.internalIdentityId !== command.administratorId
    ) {
      throw new FirstAdministratorActivationConflictError();
    }
  }

  private toResult(
    administrator: FirstAdministratorBootstrap,
  ): FinalizeFirstAdministratorActivationResult {
    if (
      administrator.status !== "ACTIVE" ||
      administrator.activatedAt === undefined
    ) {
      throw new FirstAdministratorActivationNotReadyError();
    }

    return Object.freeze({
      registrationId: administrator.registrationId,
      tenantId: administrator.tenantId,
      administratorId: administrator.internalIdentityId,
      role: "TENANT_ADMINISTRATOR",
      status: "ACTIVE",
      activatedAt: administrator.activatedAt,
    });
  }
}