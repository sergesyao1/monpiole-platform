# services/billing

## Purpose

Billing bounded context.

## Ownership

Billing Team owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Manage billing domain rules and financial state.
- Manage billing workflows and ledger-related processes.
- Integrate with external billing providers through explicit contracts.

## Data Ownership

Owns billing state, financial records, ledger data, and billing workflow state.

## Boundaries

- Does not modify financial or business data owned by another service.
- Does not expose internal persistence structures as inter-service contracts.
- Integrates with other Bounded Contexts through explicit APIs or events.

## Conventions

Keep financial state auditable and integrate through explicit idempotent contracts.

## Expected contents

Billing domain, provider adapters, ledger workflows, and tests.

