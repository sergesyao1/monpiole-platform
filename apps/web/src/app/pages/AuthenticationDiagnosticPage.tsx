import { useMemo, useState } from "react";

import { useSession } from "../../auth/session.js";
import {
  ApiForbiddenError,
  ApiSessionExpiredError,
  createAuthenticatedApiClient,
} from "../../infrastructure/http/api-client.js";

type DiagnosticState = "idle" | "loading" | "success" | "session-expired" | "forbidden" | "error";
type AuthorizationProbeState = "idle" | "loading" | "forbidden" | "authorized" | "session-expired" | "error";

export function AuthenticationDiagnosticPage() {
  const session = useSession();
  const request = useMemo(() => createAuthenticatedApiClient(session), [session]);
  const [state, setState] = useState<DiagnosticState>("idle");
  const [authorizationState, setAuthorizationState] = useState<AuthorizationProbeState>("idle");

  async function verify() {
    setState("loading");
    try {
      const response = await request<{ authenticated: true }>("/v1/authentication/session");
      setState(response.authenticated ? "success" : "error");
    } catch (error) {
      if (error instanceof ApiSessionExpiredError) setState("session-expired");
      else if (error instanceof ApiForbiddenError) setState("forbidden");
      else setState("error");
    }
  }

  async function verifyForbiddenOperation() {
    setAuthorizationState("loading");
    try {
      await request<void>("/v1/authentication/authorization/platform-tenant-creation");
      setAuthorizationState("authorized");
    } catch (error) {
      if (error instanceof ApiForbiddenError) setAuthorizationState("forbidden");
      else if (error instanceof ApiSessionExpiredError) setAuthorizationState("session-expired");
      else setAuthorizationState("error");
    }
  }

  return (
    <div className="page-stack">
      <section className="hero" aria-labelledby="authentication-diagnostic-title">
        <div>
          <p className="eyebrow">Diagnostic d’authentification</p>
          <h1 id="authentication-diagnostic-title">Vérifier la connexion à l’API</h1>
          <p className="hero-copy">
            Ce contrôle transmet un access token à l’API, puis vérifie que l’identité Auth0 est liée à une autorité MonPiole active.
          </p>
          <button className="primary-action" type="button" disabled={state === "loading"} onClick={() => void verify()}>
            {state === "loading" ? "Vérification en cours…" : "Vérifier ma session API"}
          </button>
        </div>
      </section>

      <div role="status" aria-live="polite">
        {state === "success" && <p>Connexion réussie : l’API reconnaît votre autorité MonPiole.</p>}
        {state === "session-expired" && <p>Votre session a expiré. Veuillez vous reconnecter.</p>}
        {state === "forbidden" && <p>Vous n’êtes pas autorisé à effectuer cette action.</p>}
        {state === "error" && <p>La vérification a échoué. Réessayez ou consultez les journaux de l’API.</p>}
      </div>

      <section className="foundation-note" aria-labelledby="authorization-probe-title">
        <div className="note-icon" aria-hidden="true">403</div>
        <div>
          <h2 id="authorization-probe-title">Vérifier un refus d’autorisation</h2>
          <p>Cette sonde demande à l’API si votre autorité interne peut créer un tenant, sans créer ni modifier aucune donnée.</p>
          <button className="secondary-action" type="button" disabled={authorizationState === "loading"} onClick={() => void verifyForbiddenOperation()}>
            {authorizationState === "loading" ? "Vérification en cours…" : "Tester le refus 403"}
          </button>
          <div role="status" aria-live="polite">
            {authorizationState === "forbidden" && <p>Votre session reste authentifiée, mais cette opération est interdite.</p>}
            {authorizationState === "authorized" && <p>Cette autorité possède le droit de créer un tenant ; aucun refus 403 n’était attendu.</p>}
            {authorizationState === "session-expired" && <p>Votre session a expiré. Veuillez vous reconnecter.</p>}
            {authorizationState === "error" && <p>La vérification du refus a échoué sans réponse exploitable.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
