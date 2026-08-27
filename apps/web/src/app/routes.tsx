import type { RouteObject } from "react-router";

import { AuthenticationBoundary } from "../auth/AuthenticationBoundary.js";
import { LoginPage } from "../auth/LoginPage.js";
import { HomePage } from "./pages/HomePage.js";
import { LoadingPage } from "./pages/LoadingPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { RouteErrorPage } from "./pages/RouteErrorPage.js";
import { ApplicationShell } from "./shell/ApplicationShell.js";
import { AuthenticationDiagnosticPage } from "./pages/AuthenticationDiagnosticPage.js";

export const applicationRoutes: RouteObject[] = [
  { path: "/connexion", element: <LoginPage /> },
  {
    element: <AuthenticationBoundary />,
    children: [{
      path: "/",
      element: <ApplicationShell />,
      errorElement: <RouteErrorPage />,
      hydrateFallbackElement: <LoadingPage />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "biens", element: <PlaceholderPage eyebrow="Biens immobiliers" title="Vos biens seront réunis ici" description="La consultation et la gestion des biens seront ajoutées dans un prochain vertical slice UI." /> },
        { path: "proprietaires", element: <PlaceholderPage eyebrow="Propriétaires" title="L'espace propriétaires se prépare" description="La gestion des personnes physiques et morales n'est pas encore disponible dans cette interface." /> },
        { path: "diagnostic-authentification", element: <AuthenticationDiagnosticPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    }],
  },
];
