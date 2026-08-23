import { defineConfig, type TestProjectConfiguration } from "vitest/config";

function nodeProject(
  name: string,
  include: readonly string[],
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
    },
  };
}

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      nodeProject("unit", ["tests/unit/**/*.test.ts"]),
      nodeProject("integration", ["tests/integration/**/*.test.ts"]),
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
