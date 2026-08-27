import { NavLink, Outlet } from "react-router";
import { useSession } from "../../auth/session.js";

const navigation = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/biens", label: "Biens immobiliers", end: false },
  { to: "/proprietaires", label: "Propriétaires", end: false },
  { to: "/diagnostic-authentification", label: "Diagnostic connexion", end: false },
] as const;

export function ApplicationShell() {
  const session = useSession();
  const identity = session.user?.name ?? session.user?.email ?? "Utilisateur MonPiole";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu-principal">Aller au contenu principal</a>
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="MonPiole — accueil">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>
            <strong>MonPiole</strong>
            <small>Gestion immobilière</small>
          </span>
        </NavLink>

        <nav className="main-navigation" aria-label="Navigation principale">
          <p className="navigation-label">Espace de travail</p>
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `navigation-link${isActive ? " is-active" : ""}`}
            >
              <span className="navigation-dot" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          <span>
            <strong>{identity}</strong>
            <small>Session sécurisée</small>
          </span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">Votre espace MonPiole</p>
            <p className="topbar-context">Fondation de l'application</p>
          </div>
          <button className="secondary-action" type="button" onClick={() => void session.logout()}>Se déconnecter</button>
        </header>
        <main id="contenu-principal" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
