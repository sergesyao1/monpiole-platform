# services/identity

## Purpose

Identity and access bounded context.

## Ownership

Identity Team owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Manage identity and access domain rules.
- Manage authentication and authorization decisions.
- Manage identity lifecycle and access-related workflows.

## Data Ownership

Owns identity records, credentials, authentication state, authorization data, and access policies.

## Boundaries

- Does not share credential storage directly with another service.
- Does not modify another service's business data.
- Exposes identity capabilities through explicit contracts.

## Conventions

Make authentication and authorization decisions auditable; never share credential storage directly.

## Expected contents

Identity domain, application use cases, adapters, migrations, and tests.

