import { createApiApplication } from "./bootstrap.js";
import { createPostgresApiRuntime } from "./composition/create-postgres-runtime-composition.js";
import { browserCorsConfigurationFromEnvironment, configureBrowserCors } from "./configuration/browser-cors.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const browserCors = browserCorsConfigurationFromEnvironment(process.env);
const runtime = createPostgresApiRuntime(process.env);
const application = await createApiApplication(undefined, runtime.composition);
configureBrowserCors(application, browserCors);

application.enableShutdownHooks();
try {
  await application.listen(port);
} catch (error) {
  await runtime.close();
  throw error;
}
