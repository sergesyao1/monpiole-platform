import { NavLink, Outlet, useLocation } from "react-router";
import { useSession } from "../../auth/session.js";
import { Button } from "../../ui/index.js";

const primaryNavigation = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/properties", label: "Biens immobiliers", end: false },
  { to: "/proprietaires", label: "Propriétaires", end: false },
] as const;

const supportNavigation = [
  { to: "/diagnostic-authentification", label: "Diagnostic connexion", end: false },
] as const;

function routeContext(pathname: string) {
  if (pathname === "/properties/new") return "Nouveau bien";
  if (/^\/properties\/[^/]+$/.test(pathname)) return "Fiche du bien";
  if (pathname.startsWith("/properties")) return "Portefeuille immobilier";
  if (pathname === "/proprietaires/new") return "Nouveau propriétaire";
  if (/^\/proprietaires\/[^/]+$/.test(pathname)) return "Fiche propriétaire";
  if (pathname.startsWith("/proprietaires")) return "Annuaire des propriétaires";
  if (pathname.startsWith("/diagnostic-authentification")) return "Diagnostic de connexion";
  return "Tableau de bord";
}

function NavigationGroup({ items, label }: Readonly<{
  items: readonly { to: string; label: string; end: boolean }[];
  label: string;
}>) {
  return (
    <div className="navigation-group">
      <p className="navigation-label">{label}</p>
      {items.map((item) => (
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
    </div>
  );
}

export function ApplicationShell() {
  const session = useSession();
  const location = useLocation();
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
          <NavigationGroup items={primaryNavigation} label="Espace de travail" />
          <NavigationGroup items={supportNavigation} label="Assistance" />
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
            <p className="topbar-context">{routeContext(location.pathname)}</p>
          </div>
          <Button variant="secondary" onClick={() => void session.logout()}>Se déconnecter</Button>
        </header>
        <main id="contenu-principal" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
