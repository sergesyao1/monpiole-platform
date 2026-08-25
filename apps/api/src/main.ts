import { createApiApplication } from "./bootstrap.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const application = await createApiApplication();

application.enableShutdownHooks();
await application.listen(port);
