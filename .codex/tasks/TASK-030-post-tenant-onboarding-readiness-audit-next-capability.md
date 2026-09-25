# TASK-030 — Post-Tenant-Onboarding Readiness Audit & Next Capability Selection

## Status

DONE

## Objective

Reassess Tenant Onboarding from the repository state after TASK-029, classify
remaining gaps, decide whether the capability is ready for the current platform
baseline, and select exactly one evidence-backed next vertical capability.

## Repository state audited

- HEAD: `95bb1d7 feat(api): wire PostgreSQL Identity runtime composition`.
- Working tree was clean before this documentation-only audit.
- TASK-023 through TASK-029 and their committed implementations were reviewed.
- Tenant Management and Identity Domain, Application, Infrastructure,
  migrations, public exports, API composition, controllers, Zod schemas,
  Problem Details, OpenAPI, tests, architecture rules, CI workflow, ADR-0003
  through ADR-0006, TD-004 through TD-009, roadmap, backlog, and approved Tenant
  Onboarding product contract were inspected.

## Implemented capability baseline

The executable sequence is:

```text
Create Tenant (PENDING, PostgreSQL, idempotency, TenantCreated Outbox)
  -> Bootstrap TENANT_ADMINISTRATOR (PENDING_ACTIVATION, PostgreSQL)
  -> Activate TENANT_ADMINISTRATOR (ACTIVE, PostgreSQL)
  -> Activate Tenant (ACTIVE, TenantActivated Outbox)
```

The complete sequence is proven through the real PostgreSQL composition in
`api-identity-postgres-runtime.test.ts`, but Create Tenant in that test uses the
explicit deterministic authority adapter because production authority remains
unselected.

## Reassessment of TASK-027, TASK-028, and TASK-029 gaps

| Earlier finding | Current status | Evidence |
| --- | --- | --- |
| Identity state was process-local and lost on restart | CLOSED | TASK-028 Identity schema, migration, `PostgresIdentityStore`, rehydration, and fresh-store reload tests |
| Administrator bootstrap was not durably atomic | CLOSED | Identity and membership insert in one tenant-scoped PostgreSQL transaction with uniqueness/FK/check constraints |
| Administrator `ACTIVE` state was ephemeral | CLOSED | PostgreSQL update and fresh-store reload prove `ACTIVE` |
| Tenant activation readiness depended on in-memory Identity | CLOSED | TASK-029 runtime composes one PostgreSQL store for bootstrap, activation, and `HasActiveTenantAdministrator` |
| Full lifecycle was not proven against both service schemas | CLOSED | Runtime integration exercises Create -> Bootstrap -> Activate Administrator -> Activate Tenant |
| Cross-tenant administrator readiness could leak | CLOSED | Explicit tenant arguments, forced RLS, tenant predicates, membership verification, and runtime isolation test |
| Normal runtime silently risked ephemeral Identity fallback | CLOSED | `main.ts` uses `createPostgresApiRuntime`; missing/invalid database configuration fails explicitly; in-memory construction is test-explicit only |
| Create Tenant production authentication/authority | OPEN | Runtime composition supplies neither Create Tenant use case nor `PlatformAuthorityProvider`; the default authority denies the call |
| Authorization of bootstrap/administrator activation/tenant activation | OPEN | All three controllers declare `security: []` and have no authorization port/guard before side effects |
| Approved audit trail | PARTIALLY CLOSED | Correlation and some actor/authority metadata are persisted, but no complete immutable audit record exists for initiation, bootstrap, activation, or failure |
| Broker delivery of lifecycle events | OPEN / DEFERRED | Durable Outbox rows exist; broker and dispatcher remain intentionally unselected under TD-007 |
| Automated migration/CI coverage | PARTIALLY CLOSED | PostgreSQL tests apply Identity migrations, but CI does not invoke `service:identity:migration:check` explicitly |
| Repository documentation reflects delivered product state | PARTIALLY CLOSED | TASK/service records are current; root README, PROJECT_CONTEXT, CURRENT_SPRINT, BACKLOG BL-0001, TD inventory Testcontainers version, and parts of test guidance remain stale |
| Root lint and aggregate typecheck commands | OPEN | No root `lint` or `typecheck` script exists; repository-specific typechecks pass |

## Detailed readiness findings

### BLOCKER

1. **No production onboarding authority.** The approved product contract says
   only an authorized MonPiole platform actor may initiate onboarding. Normal
   runtime cannot execute Create Tenant because its authority provider remains
   unavailable. This is safe fail-closed behavior, but it means the public
   runtime cannot initiate the workflow.
2. **Post-create mutations are unauthenticated and unauthorized.** Bootstrap
   Administrator, Activate Administrator, and Activate Tenant explicitly publish
   `security: []`. Possession of UUID path values is currently sufficient to
   attempt protected mutations. RLS prevents cross-tenant data access but does
   not replace actor authentication or authorization.

### REQUIRED

1. **Complete audit evidence.** The approved contract requires auditable
   initiation, actor, tenant creation, activation, and failure. Correlation is
   preserved, but actor/authority is not propagated through every command and
   no Audit-owned immutable trail or approved failure guarantee exists.
2. **Product/API orchestration alignment.** The approved observable onboarding
   result contains tenant lifecycle state and bootstrap administrator reference.
   The repository exposes four separately callable operations and no
   server-owned orchestration/result contract. The sequence is valid and leaves
   failed bootstrap tenants safely `PENDING`, but this remains a gap between the
   approved product-level operation and the current low-level API surface.
3. **Identity migration CI gate.** Add the already-existing
   `service:identity:migration:check` to the persistence CI job so schema/journal
   drift is directly governed, not only exercised incidentally by Testcontainers.
4. **Migration/deployment operations.** Both service migrations coexist and are
   tested with separate Drizzle history tables, but no production migration
   orchestration, ordering, rollback, or runbook is selected. TD-010/TD-011
   remain prerequisites for deployment claims.
5. **Governance documentation reconciliation.** BL-0001 still says On hold / Not
   promoted / Not delivered; PROJECT_CONTEXT and CURRENT_SPRINT still claim no
   runtime or business code; the TD inventory still names an older conditional
   Testcontainers version. These records cannot be used as current delivery
   evidence until reconciled by their owners.

### HARDENING

1. Add governed root `lint` and aggregate `typecheck` commands if the owners
   approve a lint baseline; do not alias architecture checks as lint.
2. Add database readiness/operational health, structured security-safe logs,
   metrics, and traces after TD-012 requirements are approved.
3. Check affected-row counts on Identity activation updates so future delete or
   concurrency capabilities cannot turn a disappeared identity into a silent
   success.
4. Define Create Tenant idempotency retention/expiration before unbounded
   production operation; TASK-023 intentionally left it undefined.
5. Reconcile the mixed `/api/v1/...` and `/v1/...` route prefixes only through a
   compatibility-governed API evolution, not an incidental breaking change.

### DEFERRED

- Outbox dispatcher, broker/client/topology, Inbox consumers, retries, and
  quarantine until a concrete producer/consumer flow passes the TD-007 broker
  selection gate.
- Login, credentials, password lifecycle, sessions, refresh tokens, OAuth/OIDC,
  MFA, invitations, and email verification except the minimum authentication
  adapter selected for the next capability.
- Billing, subscriptions, payment, property/rental/advertising modules, public
  self-service onboarding, and dedicated UI; the approved onboarding contract
  explicitly excludes them.
- Container packaging, deployment platform, backup/restore topology, and full
  observability technology under TD-010 through TD-012.

## Readiness verdict

### Technical lifecycle baseline

**READY.** Domain transitions, persistence, RLS isolation, duplicate and
idempotency protection, transactional Outbox boundaries, runtime Identity
composition, restart behavior, contracts, and automated verification are
cohesive and green.

### Tenant Onboarding capability

**NOT READY for public/production use.** The runtime is fail-closed for Create
Tenant and unauthenticated for the subsequent protected mutations. The approved
audit requirement is also incomplete.

Therefore Tenant Onboarding must not be declared unconditionally READY for the
current platform baseline. The accurate status is **TECHNICAL BASELINE READY;
SECURITY/AUDIT CONDITIONS OPEN**.

## Plausible next capabilities

| Candidate | Value | Prerequisites and satisfied dependencies | Missing dependencies | Risk | Selection assessment |
| --- | --- | --- | --- | --- | --- |
| Authenticated Tenant Onboarding authority | Closes the direct security/runtime blocker and makes the workflow callable by an accountable actor | Identity ownership, Nest composition, Problem Details, bearer OpenAPI mechanism, authority port, correlation, PostgreSQL and tests exist | Security/Product must approve principal source, accepted actor/claims, authority rules, 401/403 disclosure, and authentication technology under ADR-0002 | High security sensitivity; claim/tenant confusion could cause privilege escalation | **SELECTED.** It is required before audit can reliably attribute every action and before public runtime readiness |
| Audit trail vertical slice | Satisfies approved audit evidence and supports compliance/forensics | Audit bounded context ownership, correlation IDs, Tenant Outbox, event envelope exist | Authenticated actor is absent from three mutations; audit contract, retention, failure atomicity and delivery are unresolved | High if implemented before actor provenance and delivery guarantees | Do after authenticated authority; otherwise records cannot reliably identify the actor |
| Transactional Outbox dispatcher/broker | Enables external Tenant lifecycle consumers such as Audit/Workflow | Durable Outbox and TD-007 broker-neutral contracts exist | No approved consumer flow, broker/client/topology or operational compatibility gate | Medium-high operational scope | Not next; TD-007 explicitly forbids premature broker selection |
| Observability/runtime readiness | Improves diagnostics, readiness and production operations | Correlation context and workload now exist | TD-012 technology decision, retention/redaction/alerting requirements, deployment topology | Medium, mostly platform-wide | Valuable after the security boundary; does not make onboarding authorized |
| Billing/subscription or property capability | Adds direct business value beyond onboarding | Bounded-context placeholders and ownership exist | No approved product contract, APIs, lifecycle, persistence or dependencies; onboarding security remains open | Very high product/architecture uncertainty | Not next; explicitly outside BL-0001 and the approved onboarding contract |

## Selected next capability

### TASK-031 — Tenant Onboarding Authenticated Authority Vertical Slice

**Implementation objective:** establish the smallest approved production
authentication and authorization boundary for all four Tenant Onboarding
mutations. Resolve an authenticated platform actor at the API boundary,
authorize pre-tenant and post-creation actions before side effects, propagate
distinct actor/authority/correlation metadata through commands and persistence,
and publish stable 401/403 Problem Details and OpenAPI security semantics.

TASK-031 must begin with a Product/Security/Identity approval gate for the
accepted actor, claims, authority rules, authentication adapter, and safe error
disclosure. It must not invent password, JWT issuance, session, OAuth/OIDC, or
credential lifecycle behavior. Tests must prove unauthorized requests have no
persistence or event side effects and that tenant-scoped authority cannot cross
tenant boundaries.

## Verification evidence

Executed from repository root on 2026-08-25:

```text
corepack pnpm install --frozen-lockfile                         PASS
corepack pnpm typecheck:tests                                  PASS
corepack pnpm architecture:check                               PASS
corepack pnpm app:api:typecheck                                PASS
corepack pnpm app:api:build                                    PASS
corepack pnpm service:tenant-management:migration:check        PASS
corepack pnpm service:identity:migration:check                 PASS
corepack pnpm test:unit                                        PASS — 6 files / 34 tests
corepack pnpm test:integration                                 PASS — 8 files / 38 tests
corepack pnpm test:contract                                    PASS — 8 files / 54 tests
corepack pnpm package:persistence:test:integration             PASS — 3 files / 23 tests
corepack pnpm test                                             PASS — 25 files / 149 tests
```

Architecture verification reported workspace, exports, resolver, graph,
boundaries, cycles, and diagnostics green. The checker retains semantic
ownership and runtime/network/database access as manual review controls.

## Documentation correction made by TASK-030

`tests/README.md` was corrected to reflect that Testcontainers is now installed
and used for PostgreSQL adapter tests. Broader stale governance records are
reported above rather than rewritten outside their owners' planning process.

## Exit decision

TASK-030 is complete. No selected capability was implemented.

Next recommended task: **TASK-031 — Tenant Onboarding Authenticated Authority
Vertical Slice**.
