# ADR 0004: Make tenant context an explicit architectural invariant

- Status: Accepted
- Date: 2026-08-01

## Context

A multi-tenant platform must prevent data and authority leakage across tenant boundaries while preserving traceability of work across services and asynchronous processing.

## Decision

Tenant context and correlation identifiers are explicit at API, command, event, persistence, logging, and audit boundaries. Data access is scoped by tenant and authorisation is evaluated before side effects. Privileged and security-relevant actions are auditable.

## Consequences

New APIs, events, persistence adapters, background handlers, and operational tooling must define how tenant context is resolved, propagated, validated, and audited. Hidden global tenant state and unscoped data access are prohibited.