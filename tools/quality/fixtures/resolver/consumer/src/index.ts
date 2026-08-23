import {
  fixtureContractVersion,
  type ArchitectureFixtureContract,
} from "@monpiole/architecture-fixture-contract";
import type { FixtureFeature } from "@monpiole/architecture-fixture-contract/feature";

export const fixture: ArchitectureFixtureContract = {
  correlationId: `resolver-${fixtureContractVersion}`,
};

export const loadFixtureContract = async (): Promise<FixtureFeature> => {
  const contract = await import("@monpiole/architecture-fixture-contract");
  if (contract.fixtureContractVersion !== "v1") {
    throw new Error("TypeScript did not resolve the expected package export");
  }
  return { enabled: true };
};
