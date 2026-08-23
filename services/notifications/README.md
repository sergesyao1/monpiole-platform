# services/notifications

## Purpose

Notification delivery bounded context.

## Ownership

Communications Team owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Manage notification delivery workflows.
- Consume notification-related events.
- Manage delivery providers and recipient notification state.

## Data Ownership

Owns notification state, delivery state, notification templates, and delivery metadata.

## Boundaries

- Does not own the business state that triggers a notification.
- Does not modify another service's business data.
- Uses explicit APIs or events for communication with other Bounded Contexts.

## Conventions

Use asynchronous, idempotent delivery and keep recipient data protected.

## Expected contents

Notification templates, delivery adapters, event consumers, and tests.

