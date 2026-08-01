# ADR 0003: Treat APIs and events as versioned contracts

- Status: Accepted
- Date: 2026-08-01

## Context

MonPiole is API-first and event-driven. Independent bounded contexts require integration rules that preserve autonomy and compatibility.

## Decision

Public APIs and integration events are explicit, versioned contracts. Services integrate through these contracts rather than shared databases or internal persistence models. Contract evolution is additive by default. Breaking changes require explicit approval, migration guidance, and compatibility verification.

## Consequences

API and event documentation, schemas, and contract tests become part of the delivery surface. Consumers must tolerate supported additive change. Event handlers must be idempotent, observable, and safe to retry.