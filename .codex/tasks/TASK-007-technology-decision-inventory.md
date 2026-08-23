# TASK-007 — Technology Decision Inventory

## Status

Planned.

## ADR

ADR-0002 — Technology Selection Gate

## Objective

Inventory the technology decisions that are genuinely required before
MonPiole can move from the current architecture baseline into implementation.

This task is discovery only. It must not select, install, or recommend a
technology as accepted.

## Scope

Audit the current repository, ADR-0001 through ADR-0006, current tasks,
tooling requirements, backlog, and known blockers in order to identify:

- technology decisions explicitly required by accepted ADRs;
- technology decisions required to unblock existing tasks;
- dependencies between those decisions;
- decisions that are required now versus decisions that can be deferred;
- the corresponding ADR or decision record that must be created before selection.

## Required analysis

At minimum, evaluate whether explicit decisions are required for:

- runtime;
- language / module system where applicable;
- monorepo and package management;
- application framework;
- persistence;
- API implementation;
- eventing / messaging infrastructure;
- unit, integration, contract, and architecture testing;
- architecture dependency checking;
- CI execution;
- container/runtime packaging;
- deployment platform;
- observability and monitoring.

Do not assume that every item above requires an immediate decision.

## Rules

- Respect ADR-0002.
- Do not select or install technology.
- Do not create dependency lockfiles.
- Do not introduce runtime code.
- Do not create deployable infrastructure.
- Do not modify accepted ADRs.
- Treat ADR-0001 through ADR-0006 as the current accepted baseline.
- ADR-0007 and higher do not currently exist as accepted ADRs.
- Distinguish a requirement from a technology choice.
- Distinguish blocking decisions from deferrable decisions.

## Expected output

Produce an evidence-backed decision inventory containing, for each decision:

- Decision ID;
- decision area;
- problem to solve;
- source ADR / task / repository evidence;
- blocking or non-blocking status;
- downstream tasks affected;
- dependencies on other decisions;
- required ADR before technology selection;
- recommended sequencing.

The final report must clearly identify the smallest set of decisions required
to unblock the next implementation step.

## Verification

The audit must verify:

- all accepted ADRs were reviewed;
- all current task statuses were reviewed;
- TASK-006-07 and TASK-006-08 blockers were considered;
- tooling requirements and registry were considered;
- BACKLOG.md was considered;
- no technology was selected;
- no runtime or dependency configuration was introduced;
- final Git diff is reviewed.

## Acceptance Criteria

- [ ] Required technology decision areas are identified.
- [ ] Each decision has explicit source evidence.
- [ ] Blocking and deferrable decisions are distinguished.
- [ ] Decision dependencies are documented.
- [ ] The minimum unblock set is identified.
- [ ] Required future ADRs are identified without creating accepted decisions.
- [ ] No technology is selected or installed.
- [ ] No runtime implementation is introduced.

## Constraints

Discovery only.

Any concrete technology selection must occur through an approved decision
record compliant with ADR-0002.

## Related

- ADR-0001
- ADR-0002
- ADR-0003
- ADR-0004
- ADR-0005
- ADR-0006
- TASK-006-07
- TASK-006-08
- BACKLOG.md
