# Security policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in public issues. Report them privately to the MonPiole security team through the organisation's approved security channel, including reproduction steps, impact, and affected components.

## Handling

Reports are triaged confidentially. The team will acknowledge receipt, assess impact, coordinate remediation, and agree a disclosure timeline with the reporter. Credentials, tenant data, and security logs must never be attached to public tickets or commits.

## Engineering baseline

All components must enforce tenant isolation, least-privilege access, input validation, auditable security events, and secure secret handling. See `engineering/security/` for control documentation.
