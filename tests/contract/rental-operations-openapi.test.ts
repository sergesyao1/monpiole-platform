import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const document = JSON.parse(readFileSync(fileURLToPath(new URL("../../engineering/contracts/http/openapi.json", import.meta.url)), "utf8")) as {
  paths: Record<string, Record<string, { operationId?: string; security?: unknown }>>;
};

describe("Rental Operations OpenAPI", () => {
  it("publishes the authenticated operational collection and commands", () => {
    const operations = [
      ["/v1/rental-operations", "get", "listRentalOperations"],
      ["/v1/rental-operations/leases/{id}/occupancies", "post", "startLeaseOccupancy"],
      ["/v1/rental-operations/bookings/{id}/stays", "post", "startBookingStay"],
      ["/v1/rental-operations/inspections", "post", "completeRentalInspection"],
      ["/v1/rental-operations/occupancies/{id}/end", "post", "endRentalOccupancy"],
      ["/v1/rental-operations/occupancies/{id}/checkout", "post", "checkoutShortTermStay"],
      ["/v1/rental-operations/turnovers/{id}/complete", "post", "completeCleaningTurnover"],
    ] as const;
    for (const [path, method, operationId] of operations) {
      expect(document.paths[path]?.[method]?.operationId).toBe(operationId);
      expect(document.paths[path]?.[method]?.security).not.toEqual([]);
    }
  });
});
