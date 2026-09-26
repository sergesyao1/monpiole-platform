import { describe, expect, it, vi } from "vitest";

import { AgencyTenantProvisioningAdapter } from "../../src/composition/agency-tenant-provisioning.adapter.js";

function registration(organizationType?: "REAL_ESTATE_AGENCY" | "SCI") {
  return {
    id: "d7b25161-1428-4e5b-84b8-9cfac9ba44c4",
    status: "UNDER_REVIEW" as const,
    ...(organizationType === undefined ? {} : { organizationType }),
    agencyLegalName: "Patrimoine Horizon",
    registrationNumber: "CI-ABJ-2026-B-42",
    phone: "+2250102030405",
    email: "contact@example.invalid",
    address: "Cocody",
    city: "Abidjan",
    countryCode: "CI",
    contactFirstName: "Awa",
    contactLastName: "Kone",
    contactEmail: "awa@example.invalid",
    contactPhone: "+2250506070809",
    submittedAt: "2026-09-26T10:00:00.000Z",
    createdAt: "2026-09-26T10:00:00.000Z",
    updatedAt: "2026-09-26T10:00:00.000Z",
    correlationId: "correlation-104",
  };
}

describe("AgencyTenantProvisioningAdapter organization compatibility", () => {
  it.each([
    [undefined, "REAL_ESTATE_AGENCY"],
    ["SCI" as const, "SCI"],
  ])("maps registration type %s to %s", async (organizationType, expected) => {
    const execute = vi.fn().mockResolvedValue({
      tenantId: "774df2e5-7b1a-49a1-bcc2-277441e41bbf",
      organizationId: "3635f6ca-340d-41eb-ae29-e4e79f90f101",
      lifecycleState: "PENDING",
      replayed: false,
    });

    await new AgencyTenantProvisioningAdapter({ execute }).provision({
      registration: registration(organizationType),
      idempotencyKey: "agency-registration:test",
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      organization: { type: expected },
    });
  });
});
