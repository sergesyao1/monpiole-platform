# ADR 0005: Own international reference data in a platform bounded context

- Status: Accepted
- Date: 2026-09-26

## Decision

The `platform-reference` bounded context owns Country, Language, CountryLanguage and Currency. Its data is global, read-only through V1 public APIs, and contains no tenant identifier or tenant RLS policy. Other services consume versioned reads through ports; direct cross-service database access and inter-service foreign keys are forbidden. Locale remains a validated BCP 47 value rather than a table.

## Consequences

Tenant remains the authorization/RLS boundary and Organization remains the future owner of resolved business defaults. Stable reference codes are migration-governed and deactivated rather than deleted. The initial production seed is limited to CI/fr/XOF; GH/en/GHS exists only in tests.
