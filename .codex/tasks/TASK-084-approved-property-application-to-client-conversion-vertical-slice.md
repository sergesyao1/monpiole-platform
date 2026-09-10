# TASK-084 - Approved Property Application to Client Conversion Vertical Slice

## Status

DONE

## Implementation

TASK-084 adds the explicit private operation that converts an approved
`PropertyApplication` into the existing reusable `PropertyClient` model. The
operation also records immutable application-to-client provenance. It does not
change the application status and does not create any contract.

## Domain and application rules

- Only `APPROVED` applications are eligible.
- `SUBMITTED`, `REJECTED`, and `WITHDRAWN` applications produce a conflict.
- The caller supplies only property and application identifiers.
- Tenant identity is derived from authenticated authority.
- Client display name, email, and phone are derived from the authoritative inquiry.
- One application has at most one conversion and one generated client.
- Replays return the existing conversion and client.
- The relation has no lifecycle and is immutable.
- The dedicated grant is `MANAGE_PROPERTY_APPLICATION_CLIENT_CONVERSIONS`.

## Persistence

Migration `0023_property_management_baseline.sql` creates
`property_management.property_application_client_conversions` with:

- primary key `(tenant_id, application_id)`;
- unique `(tenant_id, client_id)`;
- tenant-scoped foreign keys to applications and clients;
- forced tenant RLS;
- runtime `SELECT, INSERT` only.

The PostgreSQL adapter executes conversion in one tenant transaction. It locks the
tenant/property/application row with `FOR UPDATE`, checks for an existing conversion,
validates approval, reads the application inquiry, creates the client, and inserts the
conversion before commit. The application lock serializes concurrent attempts; the
primary and unique constraints remain the final integrity boundary. Any failure rolls
back both inserts.

## API

- `POST /v1/properties/{propertyId}/applications/{applicationId}/client`
- `GET /v1/properties/{propertyId}/applications/{applicationId}/client`

POST is naturally idempotent and returns the canonical conversion/client. GET is the
minimal read model used to recognize an already converted application. Both routes are
private, tenant-scoped, path-validated, documented in OpenAPI, and reuse the existing
PropertyClient response shape inside the conversion response.

## Web

Approved applications now check for an existing conversion. An unconverted application
shows **Créer le client**. Success or reload displays **Convertie en client**, the
client identity/contact, and explicitly states that the contract remains a separate
step. Loading and failure states are in French. Existing application pagination and
decision behavior are unchanged.

## Tests

- Application tests: successful orchestration, server-owned identifiers, replay, and
  ineligible lifecycle.
- HTTP tests: POST/GET success, validation, conflict mapping, and authentication.
- PostgreSQL test: authoritative Inquiry mapping, idempotence under two concurrent
  attempts, canonical client identity, and cross-tenant invisibility.
- Web tests: explicit conversion and existing-conversion reload behavior.

## Deferred capabilities

No PropertyContract, reservation, availability/occupation mutation, payment, invoice,
document, notification, signature, Deal, CRM, or generic workflow was introduced.

## Validation results

- Property Management, API, and Web targeted typechecks: PASS.
- Tests typecheck: PASS.
- New unit tests: PASS, 3/3.
- New HTTP integration tests: PASS, 3/3.
- New Web tests: PASS, 2/2.
- Property PostgreSQL repository suite: PASS, 56/56.
- Drizzle migration check: PASS.
- OpenAPI generation: PASS.
- Remaining repository-wide checks: recorded in the final response.
