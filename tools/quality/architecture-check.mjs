import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const relativePath = (path) => relative(repositoryRoot, path).replaceAll("\\", "/");
const failures = [];
const dependencyCruiserCli = join(repositoryRoot, "node_modules/dependency-cruiser/bin/dependency-cruise.mjs");
const typeScriptCli = join(repositoryRoot, "node_modules/typescript/bin/tsc");

function fail(control, detail) {
  failures.push(`${control}: ${detail}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function exportTargets(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === "object") return Object.values(value).flatMap(exportTargets);
  return [];
}

function workspacePatterns() {
  const definition = readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
  return [...definition.matchAll(/^\s*-\s*["']([^"']+)["']\s*$/gm)].map((match) => match[1]);
}

function matchesWorkspacePattern(directory, pattern) {
  const normalized = relativePath(directory);
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1);
    return normalized.startsWith(prefix) && !normalized.slice(prefix.length).includes("/");
  }
  return normalized === pattern;
}

function packageDirectories() {
  const roots = ["apps", "services", "packages"];
  const directories = [];
  for (const root of roots) {
    const absoluteRoot = join(repositoryRoot, root);
    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(absoluteRoot, entry.name, "package.json"))) {
        directories.push(join(absoluteRoot, entry.name));
      }
    }
  }
  const fixtureRoot = join(repositoryRoot, "tools/quality/fixtures/resolver");
  for (const entry of readdirSync(fixtureRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(fixtureRoot, entry.name, "package.json"))) {
      directories.push(join(fixtureRoot, entry.name));
    }
  }
  return directories.sort();
}

function verifyWorkspaceAndExports() {
  const rootManifest = readJson(join(repositoryRoot, "package.json"));
  if (rootManifest.private !== true || rootManifest.type !== "module") {
    fail("workspace-root", "root package must be private and native ESM");
  }
  if (rootManifest.packageManager !== "pnpm@11.22.0") {
    fail("workspace-root", "packageManager must remain exactly pnpm@11.22.0");
  }
  if (rootManifest.devDependencies?.typescript !== "6.0.3" ||
      rootManifest.devDependencies?.["dependency-cruiser"] !== "18.2.0") {
    fail("tool-version-compatibility", "TypeScript 6.0.3 and dependency-cruiser 18.2.0 must remain exactly pinned");
  }
  const patterns = workspacePatterns();
  if (!patterns.includes("tools/quality/fixtures/resolver/*")) {
    fail("workspace-discovery", "resolver fixture workspace is not explicitly declared");
  }

  const manifests = packageDirectories().map((directory) => ({
    directory,
    manifest: readJson(join(directory, "package.json")),
  }));
  const names = new Set();
  const internalNames = new Set(manifests.map(({ manifest }) => manifest.name).filter(Boolean));
  for (const { directory, manifest } of manifests) {
    if (!patterns.some((pattern) => matchesWorkspacePattern(directory, pattern))) {
      fail("workspace-discovery", `${relativePath(directory)} has a manifest but is not a pnpm workspace`);
    }
    if (!manifest.name || names.has(manifest.name)) {
      fail("workspace-manifest", `${relativePath(directory)} has a missing or duplicate package name`);
    }
    names.add(manifest.name);
    if (manifest.type !== "module" || manifest.private !== true) {
      fail("workspace-manifest", `${relativePath(directory)} must be private native ESM`);
    }
    for (const [dependencyName, version] of Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    })) {
      if (internalNames.has(dependencyName) && !version.startsWith("workspace:")) {
        fail("workspace-dependency", `${manifest.name} must declare ${dependencyName} with workspace:`);
      }
    }
    for (const exportTarget of exportTargets(manifest.exports)) {
      if (!exportTarget.startsWith("./") || !existsSync(join(directory, exportTarget))) {
        fail("package-exports", `${manifest.name} exports invalid or missing target ${exportTarget}`);
      }
    }
  }
  for (const { manifest } of manifests) {
    for (const dependencyName of Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    })) {
      const target = manifests.find(({ manifest: candidate }) => candidate.name === dependencyName);
      if (target && exportTargets(target.manifest.exports).length === 0) {
        fail("package-exports", `${dependencyName} is consumed internally but has no explicit exports`);
      }
    }
  }
}

function formatViolations(result) {
  return (result.summary?.violations ?? [])
    .map((violation) => {
      const chain = violation.cycle?.map(({ name }) => name).join(" -> ");
      const owner = violation.from.split("/").slice(0, 2).join("/");
      return `${violation.rule.name}: ${violation.from} -> ${violation.to}; owner=${owner}; ` +
        `reason=forbidden architecture edge${chain ? `; chain=${chain}` : ""}; ` +
        "remediation=depend on an inward layer or an explicit public contract";
    })
    .sort()
    .join("\n");
}

function cruise(paths, { allowViolations = false, minimumModules = 0 } = {}) {
  if (!existsSync(dependencyCruiserCli)) {
    throw new Error("dependency-cruiser is not installed; run pnpm install --frozen-lockfile");
  }
  let result;
  try {
    const output = execFileSync(process.execPath, [dependencyCruiserCli,
      "--config", "tools/quality/dependency-cruiser.config.mjs",
      "--output-type", "json",
      ...paths,
    ], { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
    result = JSON.parse(output);
  } catch (error) {
    if (!error.stdout?.trim()) throw error;
    result = JSON.parse(error.stdout);
  }
  if (!allowViolations && (result.summary?.violations?.length ?? 0) > 0) {
    throw new Error(formatViolations(result));
  }
  const typescript = result.summary?.environment?.transpilersFound
    ?.find(({ name }) => name === "typescript");
  if (!typescript?.available) {
    throw new Error("dependency-cruiser did not load a compatible TypeScript compiler");
  }
  if ((result.summary?.totalCruised ?? 0) < minimumModules) {
    throw new Error(`dependency-cruiser cruised fewer than ${minimumModules} expected modules`);
  }
  return result;
}

function verifyGraph() {
  try {
    cruise(["apps", "services", "packages"]);
  } catch (error) {
    fail("repository-dependency-graph", error.stderr?.trim() || error.message);
  }

  try {
    cruise(["tools/quality/fixtures/resolver/consumer/src"], { minimumModules: 2 });
  } catch (error) {
    fail("typescript-esm-resolution", error.stderr?.trim() || error.message);
  }

  try {
    cruise(["tools/quality/fixtures/allowed"], { minimumModules: 7 });
  } catch (error) {
    fail("allowed-boundary-fixtures", error.stdout?.trim() || error.stderr?.trim() || error.message);
  }

  const expectedRules = new Set([
    "no-unresolved-imports",
    "no-circular-dependencies",
    "domain-does-not-depend-on-outer-layers",
    "domain-does-not-depend-on-external-technology",
    "domain-does-not-depend-on-api-contract-technology",
    "application-does-not-depend-on-adapters",
    "application-does-not-depend-on-api-contract-technology",
    "domain-does-not-depend-on-eventing-technology",
    "application-does-not-depend-on-eventing-technology",
    "domain-does-not-depend-on-persistence-technology",
    "application-does-not-depend-on-persistence-technology",
    "service-database-technology-is-infrastructure-only",
    "governed-contract-packages-do-not-depend-on-persistence-technology",
    "events-package-does-not-depend-on-outer-technology",
    "core-does-not-depend-on-outer-boundaries",
    "packages-do-not-import-owned-boundaries",
    "applications-do-not-import-package-source",
    "services-do-not-import-package-source",
    "no-shared-to-other-package-source",
    "shared-does-not-own-service-business-logic",
    "applications-do-not-import-service-internals",
    "no-billing-to-other-service-internals",
    "no-billing-to-other-service-data",
  ]);
  try {
    const result = cruise(["tools/quality/fixtures/violations"], {
      allowViolations: true,
      minimumModules: 10,
    });
    const observed = new Set((result.summary?.violations ?? []).map((violation) => violation.rule?.name));
    for (const rule of expectedRules) {
      if (!observed.has(rule)) fail("diagnostic-fixtures", `expected violation ${rule} was not reported`);
    }
    const violations = result.summary?.violations ?? [];
    for (const dependency of ["zod", "nestjs-zod", "@nestjs/swagger"]) {
      const applicationViolation = violations.some((violation) =>
        violation.rule?.name === "application-does-not-depend-on-api-contract-technology" &&
        violation.to === dependency);
      if (!applicationViolation) {
        fail("diagnostic-fixtures", `Application -> ${dependency} was not rejected`);
      }
      const domainViolation = violations.some((violation) =>
        violation.rule?.name === "domain-does-not-depend-on-api-contract-technology" &&
        violation.to === dependency);
      if (!domainViolation) {
        fail("diagnostic-fixtures", `Domain -> ${dependency} was not rejected`);
      }
    }
    for (const dependency of ["amqplib", "@nestjs/microservices", "kafkajs", "nats", "redis"]) {
      for (const layer of ["application", "domain"]) {
        const rule = `${layer}-does-not-depend-on-eventing-technology`;
        const violation = violations.some((candidate) =>
          candidate.rule?.name === rule && candidate.to === dependency);
        if (!violation) {
          fail("diagnostic-fixtures", `${layer} -> ${dependency} was not rejected by ${rule}`);
        }
      }
    }
    for (const dependency of ["@nestjs/common", "@nestjs/microservices", "amqplib", "kafkajs", "nats", "redis", "typeorm"]) {
      const violation = violations.some((candidate) =>
        candidate.rule?.name === "events-package-does-not-depend-on-outer-technology" &&
        candidate.to === dependency);
      if (!violation) {
        fail("diagnostic-fixtures", `packages/events -> ${dependency} was not rejected`);
      }
    }
    for (const dependency of ["@monpiole/persistence", "pg", "drizzle-orm", "drizzle-kit"]) {
      for (const layer of ["application", "domain"]) {
        const rule = `${layer}-does-not-depend-on-persistence-technology`;
        const violation = violations.some((candidate) =>
          candidate.rule?.name === rule && candidate.to === dependency);
        if (!violation) fail("diagnostic-fixtures", `${layer} -> ${dependency} was not rejected by ${rule}`);
      }
      const contractViolation = violations.some((candidate) =>
        candidate.rule?.name === "governed-contract-packages-do-not-depend-on-persistence-technology" &&
        candidate.to === dependency);
      if (!contractViolation) {
        fail("diagnostic-fixtures", `governed contract package -> ${dependency} was not rejected`);
      }
    }
    for (const ownedBoundary of ["apps/api/src/index.ts", "services/billing/infrastructure/persistence/repository.ts"]) {
      const violation = violations.some((candidate) =>
        candidate.rule?.name === "packages-do-not-import-owned-boundaries" &&
        candidate.from.endsWith("packages/events/src/outer-technology.ts") &&
        candidate.to.endsWith(ownedBoundary));
      if (!violation) {
        fail("diagnostic-fixtures", `packages/events -> ${ownedBoundary} was not rejected`);
      }
    }
    for (const layer of ["application", "domain"]) {
      const rule = `${layer}-does-not-depend-on-eventing-technology`;
      const violation = violations.some((candidate) =>
        candidate.rule?.name === rule &&
        (candidate.to === "@monpiole/events" || candidate.to.endsWith("packages/events/src/index.ts")));
      if (!violation) {
        fail("diagnostic-fixtures", `${layer} -> @monpiole/events was not rejected by ${rule}`);
      }
    }
  } catch (error) {
    fail("diagnostic-fixtures", error.stderr?.trim() || error.message);
  }
}

function verifyTypeScriptAndNodeResolution() {
  const buildDirectory = join(repositoryRoot, "tools/quality/fixtures/resolver/.architecture-build");
  try {
    if (!existsSync(typeScriptCli)) {
      throw new Error("TypeScript is not installed; run pnpm install --frozen-lockfile");
    }
    execFileSync(process.execPath, [typeScriptCli,
      "--build", "tools/quality/fixtures/resolver/tsconfig.json",
    ], { cwd: repositoryRoot, stdio: "pipe" });
  } catch (error) {
    fail("typescript-esm-resolution", error.stdout?.toString().trim() || error.message);
  } finally {
    rmSync(buildDirectory, { recursive: true, force: true });
  }
  try {
    execFileSync(process.execPath, [
      "tools/quality/fixtures/resolver/consumer/src/resolve.mjs",
    ], { cwd: repositoryRoot, stdio: "pipe" });
  } catch (error) {
    fail("node-package-exports", error.stderr?.toString().trim() || error.message);
  }
}

verifyWorkspaceAndExports();
verifyGraph();
verifyTypeScriptAndNodeResolution();

if (failures.length > 0) {
  console.error("Architecture verification failed:\n");
  failures.sort().forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Architecture verification passed (workspace, exports, resolver, graph, boundaries, cycles, diagnostics).\n");
  console.log("Residual review controls: semantic business ownership in packages/shared and runtime/network/database access.");
}
