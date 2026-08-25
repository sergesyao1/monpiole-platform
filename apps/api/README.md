# apps/api

## Purpose

Public API edge application.

## Ownership

API Platform owns this area and approves changes affecting its responsibilities.

## Conventions

Version external contracts, propagate tenant and correlation context, and keep business logic in services or packages.

## Expected contents

API routing, authentication adapters, OpenAPI delivery assets, and edge tests.

## TD-005 executable baseline

This workspace is the reference NestJS composition root. NestJS dependencies,
decorators, and HTTP abstractions stay within this outer application boundary;
service-owned Domain and Application layers remain framework-independent.

The baseline exposes only the operational `GET /health` endpoint. It does not
select persistence, messaging, validation/schema, authentication, telemetry,
or an alternative HTTP adapter.
