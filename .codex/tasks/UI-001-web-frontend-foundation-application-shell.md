# UI-001 — Web Frontend Foundation & Application Shell

## Status

**DONE WITH ONE ENVIRONMENTAL VISUAL-QA LIMITATION**

## Context and initial audit

Before UI-001, `apps/web`, `apps/admin`, and `apps/mobile` were documentation-only
placeholders. No executable frontend, browser framework, UI library, theme,
design tokens, route, component, mockup, or frontend test infrastructure existed.
The reserved `packages/ui`, `packages/design-system`, `packages/design-tokens`,
and `packages/sdk` directories also contained only READMEs and were not treated
as implemented capabilities.

The repository source of truth established:

- Node `24.18.0`, pnpm `11.22.0`, TypeScript `6.0.3`, native ESM, strict
  TypeScript, and exact dependency pins;
- pnpm workspace discovery through `apps/*`, `services/*`, and `packages/*`;
- Vitest `4.1.11` with unit, integration, contract, and PostgreSQL projects;
- GitHub Actions as a thin adapter over repository-owned commands;
- Clean Architecture boundaries preventing applications from importing service
  internals or private package source;
- versioned `/v1` JSON APIs, deterministic OpenAPI 3.1, RFC 9457 Problem
  Details, correlation identifiers, tenant-safe server authorization, and
  Managed OIDC with internal MonPiole authority mapping;
- no existing frontend framework decision.

The public API contracts live inside `apps/api` and are not exported as a
browser-safe package. UI-001 therefore does not import private API files or copy
Property contracts. It introduces only a structural Problem Details boundary;
future generated/shared contracts require a separately governed SDK decision.

## Decision and frontend architecture

TD-013 selects an exact-pinned React `19.2.8` SPA built by Vite `8.2.2`, with
React Router `8.3.0` in declarative mode. Native CSS provides the initial visual
foundation. Vitest, jsdom, and Testing Library provide behavior-focused tests.

This is the smallest standard foundation that supplies component composition,
routing, static production assets, TypeScript integration, and user-centered
tests without adding SSR, a frontend server runtime, global state, a full-stack
framework, or a UI library. The application structure is:

```text
apps/web/src
├── app
│   ├── pages
│   ├── shell
│   ├── App.tsx
│   └── routes.tsx
├── config
├── infrastructure/http
├── styles
└── test
```

Future business UI belongs in feature-oriented vertical slices. The shell owns
only composition and navigation; it contains no Property business rules.

## Implemented scope

- executable Vite workspace application;
- responsive, desktop-first application shell;
- French navigation, home page, honest Property and Property Owner placeholders;
- route composition, active navigation, catch-all 404, route error boundary,
  hydration loading fallback, and skip link;
- semantic landmarks, heading hierarchy, keyboard-visible focus, reasonable
  contrast, and reduced-motion behavior;
- root and package-level development, typecheck, test, build, and preview
  commands;
- public runtime configuration and `.env.example`;
- generic JSON client with base URL, correlation header, optional bearer token,
  `204` handling, and structural Problem Details recognition;
- dedicated web CI job and web project in the aggregate Vitest suite.

No Property, Property Details, commercial terms, owner management, ownership,
composition, publication, analytics, admin, mobile, or real dashboard workflow
was implemented.

## Configuration strategy

`apps/web/.env.example` documents:

```text
VITE_API_BASE_URL=http://localhost:3000
VITE_OIDC_ISSUER=
VITE_OIDC_CLIENT_ID=
VITE_OIDC_AUDIENCE=
```

`VITE_API_BASE_URL` defaults to `http://localhost:3000` and all configured URLs
are validated. Blank optional OIDC values are normalized away. Every `VITE_*`
value is public browser configuration and must never contain a client secret,
access token, credential, or other secret.

## API strategy

`requestJson` accepts only versioned `/v1/...` paths, adds a client correlation
UUID, processes JSON and maps a valid RFC 9457-shaped response to `ApiProblem`.
It accepts an optional access token supplied by a future OIDC session adapter but
does not acquire, persist, refresh, or invent one. Feature-specific clients and
contract schemas remain deferred to their owning UI slices.

## Authentication boundary

UI-001 introduces no local login, fake session, client secret, token storage, or
frontend permission engine. Public issuer/client/audience settings reserve the
configuration boundary for a later Managed OIDC slice. The API remains the
security and business-authorization boundary.

## Main files

Created:

- `.codex/tasks/UI-001-web-frontend-foundation-application-shell.md`;
- `apps/web/.env.example`;
- `apps/web/index.html`;
- `apps/web/package.json`;
- `apps/web/tsconfig.json`;
- `apps/web/vite.config.ts`;
- `apps/web/vitest.config.ts`;
- `apps/web/src/main.tsx`;
- `apps/web/src/app/App.tsx`;
- `apps/web/src/app/routes.tsx`;
- `apps/web/src/app/shell/ApplicationShell.tsx`;
- `apps/web/src/app/pages/HomePage.tsx`;
- `apps/web/src/app/pages/PlaceholderPage.tsx`;
- `apps/web/src/app/pages/NotFoundPage.tsx`;
- `apps/web/src/app/pages/RouteErrorPage.tsx`;
- `apps/web/src/app/pages/LoadingPage.tsx`;
- `apps/web/src/config/public-config.ts`;
- `apps/web/src/config/public-config.test.ts`;
- `apps/web/src/infrastructure/http/api-client.ts`;
- `apps/web/src/infrastructure/http/api-client.test.ts`;
- `apps/web/src/infrastructure/http/problem-details.ts`;
- `apps/web/src/styles/global.css`;
- `apps/web/src/test/setup.ts`;
- `apps/web/src/app/App.test.tsx`;
- `engineering/decisions/td-013-web-frontend-foundation.md`.

Modified:

- `.github/workflows/architecture-checks.yml`;
- `apps/web/README.md`;
- `engineering/decisions/technology-decision-inventory.md`;
- `package.json`;
- `pnpm-lock.yaml`;
- `scripts/ci/README.md`;
- `vitest.config.ts`.

Deleted: none.

## Commands

```text
corepack pnpm app:web:dev
corepack pnpm app:web:typecheck
corepack pnpm app:web:test
corepack pnpm app:web:build
corepack pnpm --filter @monpiole/web preview
```

Direct filtered equivalents are documented in `apps/web/README.md`.

## Tests added

Seven tests across three files cover:

- shell and French home rendering;
- essential client-side navigation;
- the 404 fallback;
- API URL normalization and invalid configuration;
- correlation propagation and JSON success;
- RFC 9457 Problem Details conversion.

## Validation results

Executed on 2026-08-26:

| Command | Result |
|---|---|
| `corepack pnpm install --frozen-lockfile` | PASS |
| `corepack pnpm app:web:typecheck` | PASS |
| `corepack pnpm app:web:test` | PASS — 3 files, 7 tests |
| `corepack pnpm app:web:build` | PASS — 81 modules, JS gzip 90.83 kB |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm app:api:typecheck` | PASS |
| `corepack pnpm app:api:build` | PASS |
| `corepack pnpm architecture:check` | PASS |
| `corepack pnpm test:unit` | PASS — 12 files, 85 tests |
| `corepack pnpm test:integration` | PASS — 12 files, 91 tests |
| `corepack pnpm test:contract` | PASS — 11 files, 63 tests |
| `corepack pnpm test` | PASS — 42 files, 290 tests |
| `corepack pnpm audit --audit-level high` | PASS — 0 high/critical; 1 moderate pre-existing |
| local Vite HTTP smoke check | PASS — HTTP 200, French document, React root and entrypoint |

No lint command or lint implementation exists in the repository; none was
invented in UI-001. Browser discovery returned no available browser, so visual
and interactive browser QA could not be executed in this environment. The
application was instead verified through jsdom behavior tests, production build,
and a real local Vite HTTP smoke check. Manual responsive visual review remains
recommended before merge.

## Known limitations and next steps

- Managed OIDC login/session integration is intentionally deferred.
- Business pages are honest placeholders with no fake data or actions.
- No generated frontend API client or shared contract package exists yet.
- SPA hosting must provide history fallback to `index.html`.
- CSS values are application-local; shared design tokens require demonstrated
  reuse before populating the reserved packages.
- No automated browser E2E or accessibility scanner is introduced.
- The audit retains one moderate development-only advisory in the existing
  Drizzle Kit dependency chain (`esbuild 0.18.20`); no new web dependency is on
  the reported path.

The recommended next task is a contained Web Authentication/OIDC vertical slice
that establishes login, callback, logout, in-memory session handling, and bearer
token injection while preserving server-owned tenant authorization. The first
Property UI slice should follow only after that boundary is operational.
