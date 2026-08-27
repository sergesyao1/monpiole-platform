import { Navigate, type RouteObject } from "react-router";

import { AuthenticationBoundary } from "../auth/AuthenticationBoundary.js";
import { LoginPage } from "../auth/LoginPage.js";
import { HomePage } from "./pages/HomePage.js";
import { LoadingPage } from "./pages/LoadingPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { RouteErrorPage } from "./pages/RouteErrorPage.js";
import { ApplicationShell } from "./shell/ApplicationShell.js";
import { AuthenticationDiagnosticPage } from "./pages/AuthenticationDiagnosticPage.js";
import { CreatePropertyPage } from "../features/properties/CreatePropertyPage.js";
import { PropertyDetailPage } from "../features/properties/PropertyDetailPage.js";
import { PropertyWorkspacePage } from "../features/properties/PropertyWorkspacePage.js";

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
        { path: "biens", element: <Navigate to="/properties" replace /> },
        { path: "properties", element: <PropertyWorkspacePage /> },
        { path: "properties/new", element: <CreatePropertyPage /> },
        { path: "properties/:propertyId", element: <PropertyDetailPage /> },
        { path: "proprietaires", element: <PlaceholderPage eyebrow="Propriétaires" title="L'espace propriétaires se prépare" description="La gestion des personnes physiques et morales n'est pas encore disponible dans cette interface." /> },
        { path: "diagnostic-authentification", element: <AuthenticationDiagnosticPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    }],
  },
];
