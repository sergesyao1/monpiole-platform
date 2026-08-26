import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingPage } from "../app/pages/LoadingPage.js";
import { useSession } from "./session.js";

export function AuthenticationBoundary() {
  const session = useSession();
  const location = useLocation();
  if (session.status === "loading") return <LoadingPage />;
  if (session.status === "error") return (
    <main className="standalone-state" role="alert">
      <p className="eyebrow">Authentification</p><h1>La session n’a pas pu être restaurée</h1>
      <p>Veuillez réessayer de vous connecter. Aucun accès à votre espace n’a été accordé.</p>
      <button className="primary-action" type="button" onClick={() => void session.login()}>Se connecter</button>
    </main>
  );
  if (session.status === "unauthenticated") return <Navigate to="/connexion" replace state={{ returnTo: `${location.pathname}${location.search}` }} />;
  return <Outlet />;
}
