import { describe, expect, it, vi } from "vitest";

import {
  FinalizeFirstAdministratorBootstrap,
} from "../../src/operations/finalize-first-administrator-bootstrap.js";

const REGISTRATION_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const ADMINISTRATOR_ID = "33333333-3333-4333-8333-333333333333";

const BOOTSTRAP_TOKEN = "bootstrap-token";
const ISSUER = "https://monpiole-dev-ci.eu.auth0.com/";
const SUBJECT = "auth0|first-administrator";
const INVITED_EMAIL = "administrator@example.com";
const CORRELATION_ID = "44444444-4444-4444-8444-444444444444";
const IDENTITY_LINKED_AT = "2026-09-18T10:00:00.000Z";
const ACTIVATED_AT = "2026-09-18T10:10:00.000Z";

function createHarness() {
  const calls: string[] = [];

  const completeIdentity = {
    execute: vi.fn(async () => {
      calls.push("completeIdentity");
      return {
        registrationId: REGISTRATION_ID,
        tenantId: TENANT_ID,
        administratorId: ADMINISTRATOR_ID,
        role: "TENANT_ADMINISTRATOR" as const,
        status: "IDENTITY_LINKED" as const,
        identityLinkedAt: IDENTITY_LINKED_AT,
      };
    }),
  };

  const activateAdministrator = {
    execute: vi.fn(async () => {
      calls.push("activateAdministrator");
      return {
        tenantId: TENANT_ID,
        administratorId: ADMINISTRATOR_ID,
        email: "admin@example.test",
        role: "TENANT_ADMINISTRATOR" as const,
        status: "ACTIVE" as const,
      };
    }),
  };

  const activateTenant = {
    execute: vi.fn(async () => {
      calls.push("activateTenant");
      return {
        tenantId: TENANT_ID,
        lifecycleState: "ACTIVE" as const,
        activatedAt: ACTIVATED_AT,
      };
    }),
  };

  const finalizeActivation = {
    execute: vi.fn(async () => {
      calls.push("finalizeActivation");
      return {
        registrationId: REGISTRATION_ID,
        tenantId: TENANT_ID,
        administratorId: ADMINISTRATOR_ID,
        role: "TENANT_ADMINISTRATOR" as const,
        status: "ACTIVE" as const,
        activatedAt: ACTIVATED_AT,
      };
    }),
  };

  const correlationIds = {
    generate: vi.fn(() => CORRELATION_ID),
  };

  return {
    calls,
    completeIdentity,
    activateAdministrator,
    activateTenant,
    finalizeActivation,
    correlationIds,
    useCase: new FinalizeFirstAdministratorBootstrap({
      completeIdentity,
      activateAdministrator,
      activateTenant,
      finalizeActivation,
      correlationIds,
    }),
  };
}

describe("FinalizeFirstAdministratorBootstrap", () => {
  it("activates the administrator and tenant before finalizing locally", async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        bootstrapToken: BOOTSTRAP_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
        email: INVITED_EMAIL,
        emailVerified: true,
      }),
    ).resolves.toEqual({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
      role: "TENANT_ADMINISTRATOR",
      status: "ACTIVE",
      identityLinkedAt: IDENTITY_LINKED_AT,
      activatedAt: ACTIVATED_AT,
    });

    expect(harness.calls).toEqual([
      "completeIdentity",
      "activateAdministrator",
      "activateTenant",
      "finalizeActivation",
    ]);

    expect(harness.completeIdentity.execute).toHaveBeenCalledWith({
      bootstrapToken: BOOTSTRAP_TOKEN,
      issuer: ISSUER,
      subject: SUBJECT,
        email: INVITED_EMAIL,
        emailVerified: true,
    });

    expect(harness.activateAdministrator.execute).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
      correlationId: CORRELATION_ID,
      authority: {
        actorId: "system:agency-first-administrator-finalization",
        authorityId: "system:agency-first-administrator-finalization",
        grants: ["ACTIVATE_TENANT_ADMINISTRATOR"],
        tenantIds: [TENANT_ID],
      },
    });

    expect(harness.activateTenant.execute).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      authority: {
        actorId: "system:agency-first-administrator-finalization",
        authorityId: "system:agency-first-administrator-finalization",
        grants: ["ACTIVATE_TENANT"],
        tenantIds: [TENANT_ID],
      },
    });

    expect(harness.finalizeActivation.execute).toHaveBeenCalledWith({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
    });
  });

  it("does not activate the tenant or finalize when administrator activation fails", async () => {
    const harness = createHarness();

    harness.activateAdministrator.execute.mockRejectedValueOnce(
      new Error("identity activation failed"),
    );

    await expect(
      harness.useCase.execute({
        bootstrapToken: BOOTSTRAP_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
        email: INVITED_EMAIL,
        emailVerified: true,
      }),
    ).rejects.toThrow("identity activation failed");

    expect(harness.activateTenant.execute).not.toHaveBeenCalled();
    expect(harness.finalizeActivation.execute).not.toHaveBeenCalled();
  });

  it("does not finalize locally when tenant activation fails", async () => {
    const harness = createHarness();

    harness.activateTenant.execute.mockRejectedValueOnce(
      new Error("tenant activation failed"),
    );

    await expect(
      harness.useCase.execute({
        bootstrapToken: BOOTSTRAP_TOKEN,
        issuer: ISSUER,
        subject: SUBJECT,
        email: INVITED_EMAIL,
        emailVerified: true,
      }),
    ).rejects.toThrow("tenant activation failed");

    expect(harness.finalizeActivation.execute).not.toHaveBeenCalled();
  });

  it("replays the complete convergent sequence", async () => {
    const harness = createHarness();

    const command = {
      bootstrapToken: BOOTSTRAP_TOKEN,
      issuer: ISSUER,
      subject: SUBJECT,
        email: INVITED_EMAIL,
        emailVerified: true,
    };

    const first = await harness.useCase.execute(command);
    const replay = await harness.useCase.execute(command);

    expect(first.status).toBe("ACTIVE");
    expect(replay.status).toBe("ACTIVE");

    expect(harness.completeIdentity.execute).toHaveBeenCalledTimes(2);
    expect(harness.activateAdministrator.execute).toHaveBeenCalledTimes(2);
    expect(harness.activateTenant.execute).toHaveBeenCalledTimes(2);
    expect(harness.finalizeActivation.execute).toHaveBeenCalledTimes(2);
  });
});
