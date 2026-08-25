import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApiApplication } from "../bootstrap.js";
import { createOpenApiDocument } from "./create-openapi-document.js";
import { serializeOpenApiDocument } from "./normalize-openapi-document.js";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const outputPath = resolve(
  repositoryRoot,
  "engineering/contracts/http/openapi.json",
);
const application = await createApiApplication({ logger: false });

try {
  await application.init();
  const content = serializeOpenApiDocument(createOpenApiDocument(application));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
  console.log(`Generated ${outputPath}`);
} finally {
  await application.close();
}
