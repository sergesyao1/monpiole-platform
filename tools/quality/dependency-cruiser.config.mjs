const serviceNames = [
  "audit",
  "billing",
  "identity",
  "notifications",
  "reporting",
  "tenant-management",
  "workflow",
];

const fixturePrefix = "(?:tools/quality/fixtures/(?:allowed|violations)/)?";

const packageNames = [
  "config", "core", "design-system", "design-tokens", "eslint-config", "events",
  "persistence", "sdk", "shared", "testing", "types", "typescript-config", "ui", "utils",
];

const crossPackageSourceRules = packageNames.map((packageName) => ({
  name: `no-${packageName}-to-other-package-source`,
  severity: "error",
  from: { path: `^${fixturePrefix}packages/${packageName}/` },
  to: {
    path: `^${fixturePrefix}packages/`,
    pathNot: `^${fixturePrefix}packages/${packageName}/`,
    dependencyTypes: ["local"],
  },
}));

const crossServiceRules = serviceNames.map((serviceName) => ({
  name: `no-${serviceName}-to-other-service-internals`,
  severity: "error",
  from: {
    path: `^${fixturePrefix}services/${serviceName}/`,
  },
  to: {
    path: `^${fixturePrefix}services/`,
    pathNot: `^${fixturePrefix}services/${serviceName}/`,
  },
}));

const crossServiceDataRules = serviceNames.map((serviceName) => ({
  name: `no-${serviceName}-to-other-service-data`,
  severity: "error",
  from: {
    path: `^${fixturePrefix}services/${serviceName}/`,
  },
  to: {
    path: `^${fixturePrefix}services/(?!${serviceName}/)[^/]+/(?:infrastructure/(?:persistence|repositories|storage)|migrations|data)/`,
  },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-circular-dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-does-not-depend-on-outer-layers",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { path: "(^|/)(application|infrastructure|interfaces|migrations)/" },
    },
    {
      name: "domain-does-not-depend-on-external-technology",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { dependencyTypes: ["core", "npm", "npm-dev", "npm-optional", "npm-peer"] },
    },
    {
      name: "domain-does-not-depend-on-api-contract-technology",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { path: "^(zod|nestjs-zod|@nestjs/swagger)(/|$)" },
    },
    {
      name: "application-does-not-depend-on-adapters",
      severity: "error",
      from: { path: "(^|/)application/" },
      to: { path: "(^|/)(infrastructure|interfaces|migrations)/" },
    },
    {
      name: "application-does-not-depend-on-api-contract-technology",
      severity: "error",
      from: { path: "(^|/)application/" },
      to: {
        path: "^(zod|nestjs-zod|@nestjs/swagger)(/|$)",
      },
    },
    {
      name: "domain-does-not-depend-on-eventing-technology",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: {
        path: "^(?:@monpiole/events|amqplib|@nestjs/microservices|kafkajs|nats|redis)(/|$)|(^|/)packages/events/",
      },
    },
    {
      name: "application-does-not-depend-on-eventing-technology",
      severity: "error",
      from: { path: "(^|/)application/" },
      to: {
        path: "^(?:@monpiole/events|amqplib|@nestjs/microservices|kafkajs|nats|redis)(/|$)|(^|/)packages/events/",
      },
    },
    {
      name: "domain-does-not-depend-on-persistence-technology",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { path: "^(?:@monpiole/persistence|pg|drizzle-orm|drizzle-kit)(/|$)|(^|/)packages/persistence/" },
    },
    {
      name: "application-does-not-depend-on-persistence-technology",
      severity: "error",
      from: { path: "(^|/)application/" },
      to: { path: "^(?:@monpiole/persistence|pg|drizzle-orm|drizzle-kit)(/|$)|(^|/)packages/persistence/" },
    },
    {
      name: "service-database-technology-is-infrastructure-only",
      severity: "error",
      from: { path: `^${fixturePrefix}services/(?![^/]+/infrastructure/)[^/]+/` },
      to: { path: "^(?:pg|drizzle-orm|drizzle-kit)(/|$)" },
    },
    {
      name: "events-package-does-not-depend-on-outer-technology",
      severity: "error",
      from: { path: `^${fixturePrefix}packages/events/` },
      to: {
        path: "^(?:@nestjs/[^/]+|amqplib|kafkajs|nats|redis|typeorm|pg|drizzle-orm|drizzle-kit|@monpiole/persistence|@prisma/[^/]+|prisma)(?:/|$)",
      },
    },
    {
      name: "governed-contract-packages-do-not-depend-on-persistence-technology",
      severity: "error",
      from: { path: `^${fixturePrefix}packages/(?:core|events|types|sdk)/` },
      to: { path: "^(?:@monpiole/persistence|pg|drizzle-orm|drizzle-kit)(/|$)|(^|/)packages/persistence/" },
    },
    {
      name: "core-does-not-depend-on-outer-boundaries",
      severity: "error",
      from: { path: `^${fixturePrefix}packages/core/` },
      to: { path: `^${fixturePrefix}(apps|services|infrastructure)/` },
    },
    {
      name: "packages-do-not-import-owned-boundaries",
      severity: "error",
      from: { path: `^${fixturePrefix}packages/` },
      to: { path: `^${fixturePrefix}(apps|services|infrastructure)/` },
    },
    {
      name: "applications-do-not-import-package-source",
      severity: "error",
      from: { path: `^${fixturePrefix}apps/` },
      to: { path: `^${fixturePrefix}packages/`, dependencyTypes: ["local"] },
    },
    {
      name: "services-do-not-import-package-source",
      severity: "error",
      from: { path: `^${fixturePrefix}services/` },
      to: { path: `^${fixturePrefix}packages/`, dependencyTypes: ["local"] },
    },
    ...crossPackageSourceRules,
    {
      name: "shared-does-not-own-service-business-logic",
      severity: "error",
      from: { path: `^${fixturePrefix}packages/shared/` },
      to: { path: `^${fixturePrefix}services/` },
    },
    {
      name: "applications-do-not-import-service-internals",
      severity: "error",
      from: { path: `^${fixturePrefix}apps/` },
      to: { path: `^${fixturePrefix}services/` },
    },
    ...crossServiceRules,
    ...crossServiceDataRules,
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    exclude: "(^|/)(node_modules|dist|coverage)/",
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "default"],
      extensions: [".ts", ".tsx", ".mts", ".js", ".mjs"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
