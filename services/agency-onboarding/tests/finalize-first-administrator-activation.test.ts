import { describe, expect, it } from "vitest";

import {
  FinalizeFirstAdministratorActivation,
  FirstAdministratorActivationConflictError,
  FirstAdministratorActivationNotReadyError,
  type FirstAdministratorBootstrap,
  type FirstAdministratorBootstrapTransaction,
  type FirstAdministratorBootstrapUnitOfWork,
} from "../src/index.js";

const REGISTRATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMINISTRATOR_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ACTIVATED_AT = "2026-09-18T23:15:00.000Z";
const ORIGINAL_ACTIVATED_AT = "2026-09-18T22:30:00.000Z";

function administrator(
  overrides: Partial<FirstAdministratorBootstrap> = {},
): FirstAdministratorBootstrap {
  return Object.freeze({
    registrationId: REGISTRATION_ID,
    tenantId: TENANT_ID,
    internalIdentityId: ADMINISTRATOR_ID,
    administratorKind: "FIRST_ADMINISTRATOR",
    status: "IDENTITY_LINKED",
    bootstrapTokenHash: "bootstrap-token-hash",
    bootstrapTokenExpiresAt: "2026-09-19T00:00:00.000Z",
    bootstrapTokenConsumedAt: "2026-09-18T22:00:00.000Z",
    createdByPlatformIdentityId:
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    createdAt: "2026-09-18T21:00:00.000Z",
    externalIssuer: "https://issuer.example/",
    externalSubject: "auth0|subject",
    identityLinkedAt: "2026-09-18T22:00:00.000Z",
    ...overrides,
  });
}

class StubUnitOfWork implements FirstAdministratorBootstrapUnitOfWork {
  constructor(
    private readonly transaction: FirstAdministratorBootstrapTransaction,
  ) {}

  execute<Result>(
    operation: (
      transaction: FirstAdministratorBootstrapTransaction,
    ) => Promise<Result>,
  ): Promise<Result> {
    return operation(this.transaction);
  }
}

function createTransaction(
  initial: FirstAdministratorBootstrap,
): {
  transaction: FirstAdministratorBootstrapTransaction;
  markCalls: string[];
} {
  let current = initial;
  const markCalls: string[] = [];

  const transaction: FirstAdministratorBootstrapTransaction = {
    async findRegistrationForUpdate() {
      return undefined;
    },

    async findAdministratorByRegistration() {
      return current;
    },

    async findAdministratorByBootstrapTokenHashForUpdate() {
      return undefined;
    },

    async markAdministratorIdentityLinked() {
      return undefined;
    },

    async markAdministratorActive(
      registrationId,
      tenantId,
      internalIdentityId,
      activatedAt,
    ) {
      markCalls.push(activatedAt);

      if (
        current.status !== "IDENTITY_LINKED" ||
        current.registrationId !== registrationId ||
        current.tenantId !== tenantId ||
        current.internalIdentityId !== internalIdentityId
      ) {
        return undefined;
      }

      current = Object.freeze({
        ...current,
        status: "ACTIVE",
        activatedAt,
      });

      return current;
    },

    async rotateAdministratorBootstrapToken() {
      return undefined;
    },

    async insertAdministrator() {},
  };

  return { transaction, markCalls };
}

function createUseCase(
  initial: FirstAdministratorBootstrap,
  now = ACTIVATED_AT,
) {
  const { transaction, markCalls } = createTransaction(initial);

  const useCase = new FinalizeFirstAdministratorActivation(
    new StubUnitOfWork(transaction),
    { now: () => now },
  );

  return { useCase, markCalls };
}

const COMMAND = Object.freeze({
  registrationId: REGISTRATION_ID,
  tenantId: TENANT_ID,
  administratorId: ADMINISTRATOR_ID,
});

describe("FinalizeFirstAdministratorActivation", () => {
  it("finalizes an identity-linked first administrator", async () => {
    const { useCase, markCalls } = createUseCase(administrator());

    const result = await useCase.execute(COMMAND);

    expect(result).toEqual({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
      role: "TENANT_ADMINISTRATOR",
      status: "ACTIVE",
      activatedAt: ACTIVATED_AT,
    });

    expect(markCalls).toEqual([ACTIVATED_AT]);
  });

  it("replays an already active administrator without changing activatedAt", async () => {
    const { useCase, markCalls } = createUseCase(
      administrator({
        status: "ACTIVE",
        activatedAt: ORIGINAL_ACTIVATED_AT,
      }),
    );

    const result = await useCase.execute(COMMAND);

    expect(result.status).toBe("ACTIVE");
    expect(result.activatedAt).toBe(ORIGINAL_ACTIVATED_AT);
    expect(markCalls).toEqual([]);
  });

  it("rejects mismatched activation coordinates", async () => {
    const { useCase, markCalls } = createUseCase(administrator());

    await expect(
      useCase.execute({
        ...COMMAND,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      }),
    ).rejects.toBeInstanceOf(
      FirstAdministratorActivationConflictError,
    );

    expect(markCalls).toEqual([]);
  });

  it.each(["PENDING_IDENTITY", "CANCELLED"] as const)(
    "rejects bootstrap status %s",
    async (status) => {
      const { useCase, markCalls } = createUseCase(
        administrator({ status }),
      );

      await expect(
        useCase.execute(COMMAND),
      ).rejects.toBeInstanceOf(
        FirstAdministratorActivationNotReadyError,
      );

      expect(markCalls).toEqual([]);
    },
  );
});
