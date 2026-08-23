# services/workflow

## Purpose

Workflow orchestration bounded context.

## Ownership

Workflow Team owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Manage long-running business process orchestration.
- Coordinate workflow state transitions.
- Process workflow-related events idempotently.

## Data Ownership

Owns workflow definitions, workflow execution state, orchestration metadata, and handler state.

## Boundaries

- Coordinates other Bounded Contexts without owning their domain data.
- Does not directly modify another service's internal persistence.
- Uses explicit APIs and events to interact with other services.

## Conventions

Model long-running processes explicitly and use idempotent event handlers.

## Expected contents

Workflow definitions, orchestration handlers, adapters, and tests.

