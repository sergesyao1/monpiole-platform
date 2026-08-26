# TASK-040 — OIDC Runtime Composition, Durable External Identity Resolution & Browser API Readiness

- Date: 2026-08-26
- Status: **DONE**

## Contexte et état initial

TASK-033 fournissait le verifier JWT et le provider OIDC, mais le runtime
PostgreSQL ne les composait pas. Identity ne persistait aucun lien externe et
l’API utilisait donc son provider fail-closed. L’API n’avait pas de CORS
navigateur. UI-002A a documenté ces blockers après UI-002.

## Objectif et périmètre

Composer le chemin OIDC réel, persister `(issuer, subject)` dans Identity,
résoudre une autorité interne après redémarrage, et autoriser explicitement les
origines Web configurées. Aucun workflow utilisateur, auto-provisioning,
frontend, RBAC complet ou refresh token custom n’est introduit.

## Décisions

- `identity.external_identities` appartient à Identity et contient issuer,
  subject, internal identity ID, tenant ID et created-at.
- La contrainte unique porte uniquement sur `(issuer, subject)`. Une FK composite
  garantit que le lien vise l’identité du tenant déclaré.
- La table utilise forced RLS. Le linking requiert le contexte tenant ; la
  résolution exacte utilise un contexte transactionnel technique dédié, puis
  recharge identité et membership sous RLS tenant.
- Seules les identités `ACTIVE` avec membership interne
  `TENANT_ADMINISTRATOR` sont résolues.
- La composition API attribue à ce rôle uniquement les grants tenant-scoped
  existants. `CREATE_TENANT` n’est pas attribué. Aucun email, rôle, scope ou
  autre claim OIDC n’est consulté.
- Token invalide et identité externe valide mais inconnue produisent tous deux
  le Problem Details 401 public afin d’éviter l’énumération. Les chemins internes
  verification puis resolution restent séparés.
- CORS exige une allowlist d’origines HTTP(S) exactes. `*`, chemins, configuration
  vide ou absente sont rejetés. Credentials navigateur sont désactivés car l’API
  utilise un bearer explicite.

## Architecture

```text
main
  -> createPostgresApiRuntime
     -> OidcAccessTokenVerifier
     -> OidcAuthenticatedAuthorityProvider
     -> IdentityExternalAuthorityAdapter
     -> PostgresExternalIdentityStore
        -> identity.external_identities
        -> identity.identities + tenant_memberships (tenant RLS)
  -> configureBrowserCors
```

Le domaine Identity reste indépendant de PostgreSQL, NestJS et Auth0. Le modèle
`ExternalIdentity` valide seulement sa clé de sécurité et ses identifiants. Le
port Application expose link/resolve ; PostgreSQL reste Infrastructure ; l’API
compose les bounded contexts.

## Provisioning

Le linking est une opération privilégiée distincte du login. Aucun endpoint
public n’est ajouté. Un mécanisme Operations ou une future administration doit
construire `ExternalIdentity` et appeler `PostgresExternalIdentityStore.link`
pour une identité interne existante. Le first login ne crée ni identité, grant
ni tenant scope.

## Configuration

Le runtime requiert les variables OIDC de TASK-033 et :

```text
API_ALLOWED_BROWSER_ORIGINS=http://localhost:5173
```

Plusieurs origines sont séparées par virgule. Les exemples frontend et backend
partagent l’issuer et l’audience. Aucun secret n’est nécessaire ou committé.

## Tests

- Unit : invariants ExternalIdentity, clé issuer/subject, identité inconnue,
  absence d’autorité par email/claims/scopes, rôle interne vers grants.
- HTTP : token valide/connu, identité inconnue, token invalide, expiré, mauvais
  issuer et mauvaise audience.
- PostgreSQL : linking, résolution après reconstruction, identité inactive,
  unicité, FK interne, RLS et survie à une reconstruction complète du runtime.
- CORS : origine autorisée, origine inconnue et preflight Authorization/JSON.

## Fichiers principaux

Créés : modèle/port/adaptateur de résolution Identity, migration 0001,
adapter de composition API, configuration CORS, tests unitaires/intégration et
ce livrable. Modifiés : runtime API, main, exports/schema/docs Identity,
documentation/configuration API, tests PostgreSQL/runtime et `.env.example`.
Supprimés : aucun.

## Validations

- typechecks Identity/API/tests : PASS ;
- tests unitaires : PASS — 14 fichiers, 95 tests ;
- tests intégration : PASS — 13 fichiers, 99 tests ;
- tests PostgreSQL Identity : PASS — 1 fichier, 9 tests ;
- migration check Identity : PASS ;
- build API et Identity : PASS ;
- tests de contrat : PASS — 11 fichiers, 63 tests ;
- architecture check : PASS ;
- suite globale : PASS — 46 fichiers, 329 tests ;
- persistence integration globale : PASS — 4 fichiers, 48 tests ;
- Property Management PostgreSQL : PASS — 1 fichier, 21 tests ;
- `git diff --check` : PASS.

## Risques et limites

- Le provisioning Auth0 et le smoke test navigateur restent manuels dans
  UI-002A ; aucun accès Auth0/browser n’est disponible dans cet environnement.
- Aucun outil local PostgreSQL/migration n’est ajouté : les suites
  Testcontainers constituent la procédure exécutable contrôlée actuelle.
- Le modèle actuel possède une membership tenant par identité. Une évolution
  multi-membership nécessitera une décision/migration additive.
- Le premier platform administrator et ses grants restent un gate Operations ;
  TASK-040 ne lui accorde pas implicitement `CREATE_TENANT`.

## Statut final

**DONE** — composition, persistance, sécurité browser, tests de reconstruction,
documentation et validations sont terminés. UI-002A est désormais prête pour le
provisioning Auth0 manuel, puis le smoke test navigateur réel.
