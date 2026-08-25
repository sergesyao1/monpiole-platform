# packages/events

## Purpose

Broker-independent executable Integration Event contract primitives.

## Ownership

Integration Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

`@monpiole/events` exposes a single public package entry point. Zod 4 schemas
validate strict producer output and additive-compatible consumer input. Event
contracts use deterministic UTF-8 JSON, explicit versions, UUID identifiers and
RFC 3339 UTC timestamps.

Tenant-scoped contracts require `tenantId`; platform-scoped contracts forbid
it. Accepted unknown consumer fields are transport-only and must not be spread
into Application values. ID generation remains the producer's responsibility.

## Expected contents

Shared envelope schemas and bounded parsing/serialization helpers. Product
event payloads remain owned by their producing bounded context and require
separate approval.

## Explicit exclusions

This package contains no broker client, NestJS integration, network publisher
or consumer, persistence, Outbox/Inbox implementation, telemetry SDK or
deployment infrastructure. Duplicate JSON object keys follow `JSON.parse`
semantics; no alternate JSON parser is selected by TASK-018.
