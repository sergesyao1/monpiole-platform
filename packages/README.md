# packages

## Purpose

Reusable, versioned platform libraries.

## Ownership

Platform Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

Packages must remain domain-neutral unless their bounded context is explicit; publish clear public APIs.

## Expected contents

Shared libraries, package manifests, tests, and package-level documentation.

`persistence/` contains the infrastructure-only PostgreSQL 18 capability
baseline. It owns no bounded-context product schema or repository.
