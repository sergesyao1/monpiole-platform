import { describe, expect, it } from "vitest";

import { migrationTargets } from "../../../apps/api/src/operations/migration-targets.js";

describe("API migration targets", () => {
  it("applies Rental Operations with the other runtime bounded contexts", () => {
    expect(migrationTargets).toContainEqual({
      folder: "services/rental-operations/migrations",
      table: "rental_operations_migrations",
    });
    expect(new Set(migrationTargets.map(({ table }) => table)).size).toBe(migrationTargets.length);
  });
});
