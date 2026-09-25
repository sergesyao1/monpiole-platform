import type { PropsWithChildren } from "react";
import { Link } from "react-router";

export function PublicCatalogLayout({ children }: PropsWithChildren) {
  return (
    <div className="public-site">
      <a className="skip-link" href="#contenu-public">Aller au contenu</a>
      <header className="public-header">
        <Link className="public-brand" to="/catalogue" aria-label="Accueil du catalogue MonPiole">
          <span aria-hidden="true">M</span><strong>monPiole</strong>
        </Link>
        <nav aria-label="Navigation publique">
          <Link to="/catalogue">Catalogue</Link>
          <Link to="/inscription-agence">Inscrire mon agence</Link>
          <Link to="/connexion">Espace de gestion</Link>
        </nav>
      </header>
      <main id="contenu-public" className="public-main">{children}</main>
      <footer className="public-footer">Catalogue immobilier MonPiole — diffusion contrôlée par organisation.</footer>
    </div>
  );
}
