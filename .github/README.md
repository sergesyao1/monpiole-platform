# .github

## Purpose

Repository automation and collaboration configuration.

## Ownership

Platform Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

Keep workflow definitions declarative, least-privilege, and versioned with the code they govern.

## Expected contents

CI workflows, issue templates, pull-request templates, and repository metadata.

## Architecture validation

`workflows/architecture-checks.yml` runs the full repository architecture check
for pull requests targeting `main`, pushes to `main`, and controlled manual runs.
It uses an ephemeral GitHub-hosted Linux runner with read-only repository access,
no secrets, no dependency cache, and cancellation of superseded runs.

The workflow executes the local source-of-truth commands unchanged and in order:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm architecture:check
```

Any non-zero command exit fails the job. Repository-owned stdout and stderr remain
the authoritative report in the workflow log, including stable rule identifiers
and remediation guidance emitted by the architecture checker. The workflow does
not retry violations, downgrade failures, or maintain a separate rule set.

Architecture exceptions are not configured in CI. They must follow the narrow,
owner-approved, justified, time-bounded process documented in
`tools/quality/README.md`; blanket exception baselines are prohibited.
