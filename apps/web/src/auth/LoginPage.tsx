import { Navigate, useLocation } from "react-router";
import { LoadingPage } from "../app/pages/LoadingPage.js";
import { useSession } from "./session.js";
import { Alert, Button } from "../ui/index.js";

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
      {session.status === "error" && <Alert tone="danger" title="Connexion impossible"><p>Une erreur d’authentification est survenue. Veuillez réessayer.</p></Alert>}
      <Button onClick={() => void session.login(returnTo)}>Se connecter</Button>
    </main>
  );
}

function readReturnPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("returnTo" in state)) return "/";
  const returnTo = state.returnTo;
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}
