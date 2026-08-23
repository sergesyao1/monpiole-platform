import { fixtureContractVersion } from "@monpiole/architecture-fixture-contract";

const featureUrl = import.meta.resolve("@monpiole/architecture-fixture-contract/feature");

if (fixtureContractVersion !== "v1") {
  throw new Error("Node did not resolve the expected package export");
}

if (!featureUrl.endsWith("/contract/src/feature.ts")) {
  throw new Error("Node did not resolve the expected package subpath export");
}
