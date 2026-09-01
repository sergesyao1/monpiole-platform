import { Link } from "react-router";
import { buttonClassName } from "../../ui/index.js";

export function NotFoundPage() {
  return (
    <section className="empty-state" aria-labelledby="not-found-title">
      <p className="error-code">404</p>
      <h1 id="not-found-title">Cette page n'existe pas</h1>
      <p>L'adresse demandée est introuvable ou n'est plus disponible.</p>
      <Link className={buttonClassName("primary")} to="/">Retour au tableau de bord</Link>
    </section>
  );
}
