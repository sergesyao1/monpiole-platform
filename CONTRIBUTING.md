# Contributing to MonPiole Platform

## Before you start

Read `AGENTS.md`, the applicable standards in `engineering/standards/`, and the relevant bounded-context documentation. Open an ADR when a change alters a durable architectural decision.

## Change expectations

Keep pull requests focused, explain tenant and security implications, and include tests at the lowest meaningful level. Public API or event-contract changes must be versioned and documented. Infrastructure changes must describe rollout and rollback behavior.

## Review

At least one owner of the affected area reviews each change. Security-sensitive changes require security review. Do not merge with known test failures, exposed secrets, or undocumented breaking changes.
