# TD-015 — Web OIDC tab-session cache

- Status: **APPROVED — IMPLEMENTED BY UI-002A**
- Date: 2026-08-26
- Governing decisions: [ADR-0007](../adr/0007-managed-oidc-authentication.md), [TD-014](td-014-web-managed-oidc-client.md)
- Decision owner: Web Engineering / Security

## Context

TD-014 selected the Auth0 SDK memory cache and expected page reload to restore
through Auth0 silent authentication. A real Auth0 browser test proved login,
PKCE, callback and API token use, but a full reload lost the MonPiole session.

The memory cache intentionally loses access, ID and rotating refresh tokens on
reload. Auth0 `checkSession` can then only repopulate it through a local SDK
cookie and cross-origin silent authorization. That path is best-effort, is
affected by browser cookie restrictions, and suppresses its initialization
error. `useRefreshTokensFallback` cannot restore a refresh token that memory has
already discarded; it falls back to the same iframe path.

## Decision

Supersede only TD-014's cache-location choice. Keep `@auth0/auth0-react`, PKCE,
rotating refresh tokens and the provider-neutral `Session` boundary.

Provide an `ICache` implementation backed by `sessionStorage`, namespaced to
MonPiole Auth0 entries. The SDK remains responsible for cache entry structure,
expiry, rotation and removal. The application never reads or logs token values.

`sessionStorage` is selected over built-in `localstorage` because it:

- survives full reload in the current tab;
- is cleared when the tab/window session ends;
- is not shared automatically with other tabs;
- avoids indefinite origin-wide token persistence.

## Security consequences

Web Storage is accessible to JavaScript. A successful same-origin XSS could
therefore read cached tokens during the tab session. This is a real regression
from memory-only storage, accepted narrowly to satisfy reliable reload
restoration without persistent localStorage. Rotating refresh tokens, short API
access-token age, dependency review, output encoding and a restrictive CSP are
important compensating controls; CSP hardening remains a separate deployment
control and must not be overstated here.

Logout remains SDK-driven and clears matching cache keys. Corrupt entries fail
closed and are removed. No client secret is introduced. OIDC claims remain
non-authoritative: the API still resolves `(issuer, subject)` to internal grants
and tenant scope.

## Alternatives rejected

- Memory plus silent iframe: failed the real target-browser reload path.
- Built-in `localstorage`: reliable but persists longer and across tabs.
- Application-owned token/refresh protocol: duplicates security-sensitive SDK
  behavior and is forbidden.
- Automatic interactive login after reload: creates redirect-loop risk and does
  not constitute session restoration.
