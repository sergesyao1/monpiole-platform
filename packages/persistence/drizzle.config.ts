import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/verification-schema.ts",
  out: "./migrations",
});
