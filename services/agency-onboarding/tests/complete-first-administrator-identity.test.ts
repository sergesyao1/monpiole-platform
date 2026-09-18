import { describe, expect, it, vi } from "vitest";

import {
  CompleteFirstAdministratorIdentity,
  FirstAdministratorBootstrapNotCompletableError,
  FirstAdministratorBootstrapTokenExpiredError,
  FirstAdministratorBootstrapTokenNotFoundError,
  FirstAdministratorIdentityLinkConflictError,
  type FirstAdministratorExternalIdentityLinkPort,
} from "../src/application/complete-first-administrator-identity.js";
import type {
  FirstAdministratorBootstrap,
  FirstAdministratorBootstrapTransaction,
  FirstAdministratorBootstrapUnitOfWork,
} from "../src/application/first-administrator-persistence.js";

const REGISTRATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMINISTRATOR_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PLATFORM_IDENTITY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const RAW_TOKEN = "synthetic-bootstrap-token";
const TOKEN_HASH = "synthetic-bootstrap-token-hash";

const CREATED_AT = "2026-09-18T10:00:00.000Z";
const NOW = "2026-09-18T10:05:00.000Z";
const EXPIRES_AT = "2026-09-18T10:30:00.000Z";

const ISSUER = "https://monpiole-dev-ci.eu.auth0.com/";
const SUBJECT = "auth0|first-agency-administrator";

function pendingAdministrator(
  overrides: Partial<FirstAdministratorBootstrap> = {},
): FirstAdministratorBootstrap {
  return {
    registrationId: REGISTRATION_ID,
    tenantId: TENANT_ID,
    internalIdentityId: ADMINISTRATOR_ID,
    administratorKind: "FIRST_ADMINISTRATOR",
    status: "PENDING_IDENTITY",
    bootstrapTokenHash: TOKEN_HASH,
    bootstrapTokenExpiresAt: EXPIRES_AT,
    createdByPlatformIdentityId: PLATFORM_IDENTITY_ID,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function linkedAdministrator(
  overrides: Partial<FirstAdministratorBootstrap> = {},
): FirstAdministratorBootstrap {
  return pendingAdministrator({
    status: "IDENTITY_LINKED",
    bootstrapTokenConsumedAt: NOW,
    externalIssuer: ISSUER,
    externalSubject: SUBJECT,
    identityLinkedAt: NOW,
    ...overrides,
  });
}

function createHarness(initial: FirstAdministratorBootstrap | undefined) {
  let administrator = initial;

  const findAdministratorByBootstrapTokenHashForUpdate = vi.fn(
    async (bootstrapTokenHash: string) => {
      if (
        administrator === undefined ||
        administrator.bootstrapTokenHash !== bootstrapTokenHash
      ) {
        return undefined;
      }

      return { ...administrator };
    },
  );

  const markAdministratorIdentityLinked = vi.fn(
    async (
      bootstrapTokenHash: string,
      internalIdentityId: string,
      externalIssuer: string,
      externalSubject: string,
      bootstrapTokenConsumedAt: string,
      identityLinkedAt: string,
    ) => {
      if (
        administrator === undefined ||
        administrator.bootstrapTokenHash !== bootstrapTokenHash ||
        administrator.internalIdentityId !== internalIdentityId ||
        administrator.status !== "PENDING_IDENTITY" ||
        administrator.externalIssuer !== undefined ||
        administrator.externalSubject !== undefined ||
        administrator.bootstrapTokenConsumedAt !== undefined ||
        administrator.identityLinkedAt !== undefined
      ) {
        return undefined;
      }

      administrator = {
        ...administrator,
        status: "IDENTITY_LINKED",
        bootstrapTokenConsumedAt,
        externalIssuer,
        externalSubject,
        identityLinkedAt,
      };

      return administrator;
    },
  );

  const transaction: FirstAdministratorBootstrapTransaction = {
    findRegistrationForUpdate: vi.fn(),
    findAdministratorByRegistration: vi.fn(),
    insertAdministrator: vi.fn(),
    findAdministratorByBootstrapTokenHashForUpdate,
    markAdministratorIdentityLinked,
  };

  const unitOfWork: FirstAdministratorBootstrapUnitOfWork = {
    execute: async <Result>(
      operation: (
        transaction: FirstAdministratorBootstrapTransaction,
      ) => Promise<Result>,
    ): Promise<Result> => operation(transaction),
  };

  const identities: FirstAdministratorExternalIdentityLinkPort = {
    canonicalize: vi.fn((input) => ({
      issuer: new URL(input.issuer).toString(),
      subject: input.subject.trim(),
    })),
    link: vi.fn(async (input) => ({
      issuer: new URL(input.issuer).toString(),
      subject: input.subject.trim(),
    })),
  };

  const useCase = new CompleteFirstAdministratorIdentity(
    unitOfWork,
    {
      hash: vi.fn((token: string) => {
        expect(token).toBe(RAW_TOKEN);
        return TOKEN_HASH;
      }),
    },
    { now: () => NOW },
    identities,
  );

  return {
    useCase,
    identities,
    findAdministratorByBootstrapTokenHashForUpdate,
    markAdministratorIdentityLinked,
    administrator: () => administrator,
  };
}

describe("CompleteFirstAdministratorIdentity", () => {
  it("links the external identity before consuming the bootstrap token", async () => {
    const harness = createHarness(pendingAdministrator());

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).resolves.toEqual({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
      role: "TENANT_ADMINISTRATOR",
      status: "IDENTITY_LINKED",
      identityLinkedAt: NOW,
    });

    expect(harness.identities.link).toHaveBeenCalledTimes(1);
    expect(harness.identities.link).toHaveBeenCalledWith({
      issuer: ISSUER,
      subject: SUBJECT,
      internalIdentityId: ADMINISTRATOR_ID,
      tenantId: TENANT_ID,
      createdAt: NOW,
    });

    expect(
      harness.markAdministratorIdentityLinked,
    ).toHaveBeenCalledTimes(1);

    expect(harness.administrator()).toEqual(
      linkedAdministrator(),
    );
  });

  it("rejects an unknown bootstrap token before calling Identity", async () => {
    const harness = createHarness(undefined);

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).rejects.toBeInstanceOf(
      FirstAdministratorBootstrapTokenNotFoundError,
    );

    expect(harness.identities.link).not.toHaveBeenCalled();
    expect(
      harness.markAdministratorIdentityLinked,
    ).not.toHaveBeenCalled();
  });

  it("rejects an expired bootstrap token before calling Identity", async () => {
    const harness = createHarness(
      pendingAdministrator({
        bootstrapTokenExpiresAt: "2026-09-18T10:04:59.999Z",
      }),
    );

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).rejects.toBeInstanceOf(
      FirstAdministratorBootstrapTokenExpiredError,
    );

    expect(harness.identities.link).not.toHaveBeenCalled();
    expect(
      harness.markAdministratorIdentityLinked,
    ).not.toHaveBeenCalled();
  });

  it("rejects a cancelled bootstrap before calling Identity", async () => {
    const harness = createHarness(
      pendingAdministrator({
        status: "CANCELLED",
        cancelledAt: NOW,
      }),
    );

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).rejects.toBeInstanceOf(
      FirstAdministratorBootstrapNotCompletableError,
    );

    expect(harness.identities.link).not.toHaveBeenCalled();
  });

  it("converges when the bootstrap is already identity linked", async () => {
    const harness = createHarness(linkedAdministrator());

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).resolves.toEqual({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
      role: "TENANT_ADMINISTRATOR",
      status: "IDENTITY_LINKED",
      identityLinkedAt: NOW,
    });

    expect(harness.identities.canonicalize).toHaveBeenCalledTimes(1);
    expect(harness.identities.link).not.toHaveBeenCalled();
    expect(
      harness.markAdministratorIdentityLinked,
    ).not.toHaveBeenCalled();
  });

  it("rejects an already linked bootstrap replayed by another external identity", async () => {
    const harness = createHarness(linkedAdministrator());

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: "auth0|another-administrator",
      }),
    ).rejects.toBeInstanceOf(
      FirstAdministratorIdentityLinkConflictError,
    );

    expect(harness.identities.canonicalize).toHaveBeenCalledTimes(1);
    expect(harness.identities.link).not.toHaveBeenCalled();
    expect(
      harness.markAdministratorIdentityLinked,
    ).not.toHaveBeenCalled();
  });

  it("converges after Identity committed but onboarding completion did not", async () => {
    const harness = createHarness(pendingAdministrator());

    let firstAttempt = true;

    harness.markAdministratorIdentityLinked.mockImplementation(
      async () => {
        if (firstAttempt) {
          firstAttempt = false;
          throw new Error("synthetic onboarding persistence failure");
        }

        const current = harness.administrator();

        if (current === undefined) {
          return undefined;
        }

        const linked = linkedAdministrator();

        Object.assign(current, linked);

        return current;
      },
    );

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).rejects.toThrow("synthetic onboarding persistence failure");

    expect(harness.identities.link).toHaveBeenCalledTimes(1);

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).resolves.toMatchObject({
      administratorId: ADMINISTRATOR_ID,
      status: "IDENTITY_LINKED",
    });

    expect(harness.identities.link).toHaveBeenCalledTimes(2);
  });

  it("rejects changed bootstrap provenance before persistence completion", async () => {
    const harness = createHarness(pendingAdministrator());

    harness.identities.link = vi.fn(async () => {
      const current = harness.administrator();

      if (current !== undefined) {
        Object.assign(current, {
          internalIdentityId:
            "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        });
      }

      return {
        issuer: ISSUER,
        subject: SUBJECT,
      };
    });

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).rejects.toBeInstanceOf(
      FirstAdministratorIdentityLinkConflictError,
    );

    expect(
      harness.markAdministratorIdentityLinked,
    ).toHaveBeenCalledTimes(1);
  });

  it("rejects a lifecycle change occurring after the Identity link", async () => {
    const harness = createHarness(pendingAdministrator());

    harness.identities.link = vi.fn(async () => {
      const current = harness.administrator();

      if (current !== undefined) {
        Object.assign(current, {
          status: "CANCELLED",
          cancelledAt: NOW,
        });
      }

      return {
        issuer: ISSUER,
        subject: SUBJECT,
      };
    });

    await expect(
      harness.useCase.execute({
        bootstrapToken: RAW_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
      }),
    ).rejects.toBeInstanceOf(
      FirstAdministratorIdentityLinkConflictError,
    );

    expect(
      harness.markAdministratorIdentityLinked,
    ).toHaveBeenCalledTimes(1);
  });
});