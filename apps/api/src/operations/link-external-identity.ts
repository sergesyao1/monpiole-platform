import { ExternalIdentity, PostgresExternalIdentityStore } from "@monpiole/identity";
import { PostgresPool, postgresConfigurationFromEnvironment } from "@monpiole/persistence";

import { externalIdentityLinkConfigurationFromEnvironment } from "./external-identity-link-configuration.js";

const configuration = externalIdentityLinkConfigurationFromEnvironment(process.env);
const externalIdentity = ExternalIdentity.create({ ...configuration, createdAt: new Date().toISOString() });
const database = new PostgresPool(postgresConfigurationFromEnvironment(process.env));

try {
  await new PostgresExternalIdentityStore(database.infrastructurePool()).link(externalIdentity);
  process.stdout.write("External identity linked to the existing MonPiole identity.\n");
} finally {
  await database.close();
}
