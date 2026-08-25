import { defineConfig, type TestProjectConfiguration } from "vitest/config";

function nodeProject(
  name: string,
  include: readonly string[],
  hookTimeout = 10_000,
): TestProjectConfiguration {
  return {
    test: {
      name,
      environment: "node",
      include: [...include],
      isolate: true,
      fileParallelism: false,
      sequence: {
        concurrent: false,
      },
      hookTimeout,
    },
  };
}

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      nodeProject("unit", ["tests/unit/**/*.test.ts"]),
      nodeProject("integration", ["tests/integration/**/*.test.ts"]),
      nodeProject("persistence-integration", [
        "packages/persistence/tests/**/*.test.ts",
        "services/tenant-management/tests/**/*.test.ts",
      ], 60_000),
      nodeProject("contract", ["tests/contract/**/*.test.ts"]),
    ],
    coverage: {
      provider: "v8",
      include: ["tests/fixtures/**/*.ts"],
      exclude: ["tests/**/*.test.ts"],
      reporter: ["text", "json-summary", "lcov"],
    },
  },
});
