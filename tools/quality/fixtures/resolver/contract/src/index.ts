export interface ArchitectureFixtureContract {
  readonly correlationId: string;
}

export const fixtureContractVersion = "v1" as const;

export type { FixtureFeature } from "./feature.js";
