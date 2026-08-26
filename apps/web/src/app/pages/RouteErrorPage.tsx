import { Link, isRouteErrorResponse, useRouteError } from "react-router";

export function RouteErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error) && error.status === 404
    ? "La ressource demandée est introuvable."
    : "Une erreur inattendue empêche l'affichage de cette page.";

  return (
    <main className="standalone-state" aria-labelledby="route-error-title">
      <p className="eyebrow">Un problème est survenu</p>
      <h1 id="route-error-title">Impossible d'afficher la page</h1>
      <p>{detail}</p>
      <Link className="primary-action" to="/">Revenir à l'accueil</Link>
    </main>
  );
}
