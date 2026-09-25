import { createHash, randomBytes } from "node:crypto";

import type {
  FirstAdministratorBootstrapTokenGenerator,
  FirstAdministratorBootstrapTokenHasher,
} from "../../application/first-administrator-bootstrap.js";

const TOKEN_ENTROPY_BYTES = 32;

export class SecureFirstAdministratorBootstrapTokenGenerator
  implements FirstAdministratorBootstrapTokenGenerator
{
  generate(): string {
    return randomBytes(TOKEN_ENTROPY_BYTES).toString("base64url");
  }
}

export class Sha256FirstAdministratorBootstrapTokenHasher
  implements FirstAdministratorBootstrapTokenHasher
{
  hash(token: string): string {
    return createHash("sha256")
      .update(token, "utf8")
      .digest("hex");
  }
}