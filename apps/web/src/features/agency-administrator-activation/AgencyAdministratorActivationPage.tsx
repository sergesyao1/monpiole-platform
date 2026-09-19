import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { useSession } from "../../auth/session.js";
import { ApiSessionExpiredError } from "../../infrastructure/http/api-client.js";
import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import { Alert, Button, LoadingState, buttonClassName } from "../../ui/index.js";
import { createAgencyAdministratorActivationApi } from "./agency-administrator-activation-api.js";

type ActivationState = "ready" | "authenticating" | "completing" | "success" | "invalid" | "expired" | "unavailable" | "conflict" | "auth-error" | "error";

export function AgencyAdministratorActivationPage() {
  const session = useSession();
  const [bootstrapToken] = useState(readAndRemoveBootstrapToken);
  const token = bootstrapToken ?? session.loginContinuation?.activationBootstrapToken;
  const [state, setState] = useState<ActivationState>(() => token ? "ready" : "invalid");
  const [attempt, setAttempt] = useState(0);
  const completionStarted = useRef(false);
  const api = useMemo(() => createAgencyAdministratorActivationApi(session), [session]);

  useEffect(() => {
    if (!token || completionStarted.current) return;
    if (session.status === "loading") return;
    if (session.status === "error") { setState("auth-error"); return; }
    if (session.status === "unauthenticated") {
      completionStarted.current = true;
      setState("authenticating");
      void session.login("/activation-agence", { activationBootstrapToken: token }).catch(() => {
        completionStarted.current = false;
        setState("auth-error");
      });
      return;
    }
    completionStarted.current = true;
    setState("completing");
    void api.complete(token).then(() => setState("success")).catch((error: unknown) => {
      completionStarted.current = false;
      setState(toErrorState(error));
    });
  }, [api, attempt, session, token]);

  function retry() { completionStarted.current = false; setState("ready"); setAttempt((current) => current + 1); }

  if (state === "authenticating") return <main className="standalone-state"><LoadingState label="Redirection vers la connexion sécurisée…" /></main>;
  if (state === "completing" || (state === "ready" && session.status === "loading")) return <main className="standalone-state"><LoadingState label="Activation de votre agence…" /></main>;
  if (state === "success") return <main className="standalone-state"><p className="eyebrow">Activation terminée</p><h1>Votre agence est activée</h1><p>Votre compte administrateur et votre espace agence sont maintenant actifs.</p><Link className={buttonClassName("primary")} to="/">Accéder à MonPiole</Link></main>;

  const content = activationErrorContent(state);
  return <main className="standalone-state"><p className="eyebrow">Activation de l’agence</p><h1>{content.title}</h1><Alert tone="danger" title={content.title}><p>{content.message}</p></Alert>{content.retry && token ? <Button onClick={retry}>Réessayer</Button> : null}</main>;
}

function readAndRemoveBootstrapToken(): string | undefined {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token")?.trim() || undefined;
  if (url.searchParams.has("token")) {
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
  }
  return token;
}

function toErrorState(error: unknown): ActivationState {
  if (error instanceof ApiSessionExpiredError) return "auth-error";
  if (error instanceof ApiProblem) {
    if (error.problem.status === 404) return "invalid";
    if (error.problem.status === 410) return "expired";
    if (error.problem.code === "FIRST_ADMINISTRATOR_IDENTITY_LINK_CONFLICT") return "conflict";
    if (error.problem.status === 409) return "unavailable";
  }
  return "error";
}

function activationErrorContent(state: ActivationState) {
  if (state === "expired") return { title: "Lien expiré", message: "Ce lien d’activation a expiré. Contactez l’équipe plateforme pour obtenir de l’aide.", retry: false };
  if (state === "unavailable") return { title: "Activation indisponible", message: "Cette activation ne peut pas être finalisée. Contactez l’équipe plateforme.", retry: false };
  if (state === "conflict") return { title: "Compte non compatible", message: "Le compte authentifié ne correspond pas à cette invitation. Contactez l’équipe plateforme.", retry: false };
  if (state === "auth-error") return { title: "Connexion impossible", message: "L’authentification n’a pas abouti. Vous pouvez réessayer en toute sécurité.", retry: true };
  if (state === "error") return { title: "Activation interrompue", message: "Le service est momentanément indisponible. Réessayez sans fermer cette page.", retry: true };
  return { title: "Lien d’activation invalide", message: "Ce lien d’activation est absent ou invalide. Vérifiez le lien reçu ou contactez l’équipe plateforme.", retry: false };
}
