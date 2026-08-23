# services/reporting

## Purpose

Reporting bounded context.

## Ownership

Data Platform Team owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Build and maintain reporting read models.
- Consume governed data and projection events.
- Expose reporting capabilities through explicit contracts.

## Data Ownership

Owns reporting read models, projections, reporting metadata, and reporting-specific derived state.

## Boundaries

- Does not query other services' operational databases directly.
- Does not modify operational data owned by another service.
- Uses governed contracts and projection mechanisms for cross-context reporting.

## Conventions

Use read models and governed data access; do not query other services’ operational databases.

## Expected contents

Projection consumers, reporting APIs, data models, and tests.

