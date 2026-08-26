import { Navigate, useLocation } from "react-router";
import { LoadingPage } from "../app/pages/LoadingPage.js";
import { useSession } from "./session.js";

export function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const returnTo = readReturnPath(location.state);
  if (session.status === "loading") return <LoadingPage />;
  if (session.status === "authenticated") return <Navigate to="/" replace />;
  return (
    <main className="standalone-state">
      <p className="eyebrow">Espace sécurisé</p><h1>Connectez-vous à MonPiole</h1>
      <p>L’authentification est prise en charge par notre fournisseur d’identité sécurisé.</p>
      {session.status === "error" && <p role="alert">Une erreur d’authentification est survenue. Veuillez réessayer.</p>}
      <button className="primary-action" type="button" onClick={() => void session.login(returnTo)}>Se connecter</button>
    </main>
  );
}

function readReturnPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("returnTo" in state)) return "/";
  const returnTo = state.returnTo;
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}
