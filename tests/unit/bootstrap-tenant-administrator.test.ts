import { describe, expect, it } from "vitest";
import {
  BootstrapAdministratorConflictError,
  BootstrapTenantAdministrator,
  InMemoryBootstrapAdministratorStore,
  TenantNotFoundError,
  IdentityOnboardingForbiddenError,
} from "../../services/identity/src/index.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMINISTRATOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CORRELATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_CORRELATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const AUTHORITY = {
  actorId: "actor-1",
  authorityId: "authority-1",
  grants: ["BOOTSTRAP_TENANT_ADMINISTRATOR"] as const,
  tenantIds: [TENANT_ID],
};

function command(
  email = " Admin@Example.com ",
  correlationId = CORRELATION_ID,
) {
  return {
    tenantId: TENANT_ID,
    email,
    firstName: " Alice ",
    lastName: " Admin ",
    correlationId,
    authority: AUTHORITY,
  };
}

function fixture(tenantExists = true, authorized = true) {
  const store = new InMemoryBootstrapAdministratorStore();

  let generated = 0;

  const useCase = new BootstrapTenantAdministrator(
    { exists: async () => tenantExists },
    store,
    {
      generate: () => {
        generated += 1;
        return ADMINISTRATOR_ID;
      },
    },
    { authorize: async () => authorized },
  );

  return {
    store,
    useCase,
    generatedCount: () => generated,
  };
}

describe("Bootstrap Tenant Administrator", () => {
  it("bootstraps the administrator for an existing tenant with normalized values", async () => {
    const { store, useCase } = fixture();

    await expect(useCase.execute(command())).resolves.toEqual({
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
      email: "admin@example.com",
      role: "TENANT_ADMINISTRATOR",
      status: "PENDING_ACTIVATION",
    });

    expect(store.identityCount()).toBe(1);
    expect(store.membershipCount()).toBe(1);
  });

  it("converges a replay with the same correlation, tenant and normalized email", async () => {
    const { store, useCase, generatedCount } = fixture();

    const first = await useCase.execute(command());
    const replay = await useCase.execute(command(" ADMIN@example.COM "));

    expect(replay).toEqual(first);
    expect(generatedCount()).toBe(1);
    expect(store.identityCount()).toBe(1);
    expect(store.membershipCount()).toBe(1);
  });

  it("rejects the same normalized email when correlation belongs to another bootstrap attempt", async () => {
    const { store, useCase } = fixture();

    await useCase.execute(command());

    await expect(
      useCase.execute(command(" ADMIN@example.COM ", OTHER_CORRELATION_ID)),
    ).rejects.toBeInstanceOf(BootstrapAdministratorConflictError);

    expect(store.identityCount()).toBe(1);
    expect(store.membershipCount()).toBe(1);
  });

  it("rejects another administrator for the tenant when correlation differs", async () => {
    const { store, useCase } = fixture();

    await useCase.execute(command());

    await expect(
      useCase.execute(command("other@example.com", OTHER_CORRELATION_ID)),
    ).rejects.toBeInstanceOf(BootstrapAdministratorConflictError);

    expect(store.identityCount()).toBe(1);
    expect(store.membershipCount()).toBe(1);
  });

  it("converges when another request wins the insert race with the same correlation", async () => {
    const winnerStore = new InMemoryBootstrapAdministratorStore();

    const winner = new BootstrapTenantAdministrator(
      { exists: async () => true },
      winnerStore,
      { generate: () => ADMINISTRATOR_ID },
      { authorize: async () => true },
    );

    const winnerResult = await winner.execute(command());

    let lookupCount = 0;

    const racingStore = {
      findBootstrapByCorrelation: async (
        correlationId: string,
        tenantId: string,
      ) => {
        lookupCount += 1;

        if (lookupCount === 1) {
          return undefined;
        }

        return winnerStore.findBootstrapByCorrelation(
          correlationId,
          tenantId,
        );
      },

      findIdentityByEmail: async () => undefined,
      findMembership: async () => undefined,

      saveAtomically: async () => {
        throw new BootstrapAdministratorConflictError();
      },
    };

    const loser = new BootstrapTenantAdministrator(
      { exists: async () => true },
      racingStore,
      {
        generate: () =>
          "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      },
      { authorize: async () => true },
    );

    await expect(
      loser.execute(command(" ADMIN@example.COM ")),
    ).resolves.toEqual(winnerResult);

    expect(lookupCount).toBe(2);
    expect(winnerStore.identityCount()).toBe(1);
    expect(winnerStore.membershipCount()).toBe(1);
  });
  it("rejects an unknown tenant without persistence", async () => {
    const { store, useCase } = fixture(false);

    await expect(useCase.execute(command()))
      .rejects.toBeInstanceOf(TenantNotFoundError);

    expect(store.identityCount()).toBe(0);
    expect(store.membershipCount()).toBe(0);
  });

  it("authorizes before tenant lookup or persistence", async () => {
    const { store, useCase } = fixture(true, false);

    await expect(useCase.execute(command()))
      .rejects.toBeInstanceOf(IdentityOnboardingForbiddenError);

    expect(store.identityCount()).toBe(0);
    expect(store.membershipCount()).toBe(0);
  });
});