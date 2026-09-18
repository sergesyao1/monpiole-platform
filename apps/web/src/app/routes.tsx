import { Navigate, type RouteObject } from "react-router";

import { AuthenticationBoundary } from "../auth/AuthenticationBoundary.js";
import { LoginPage } from "../auth/LoginPage.js";
import { PublicAgencyRegistrationPage } from "../features/agency-registration/PublicAgencyRegistrationPage.js";
import { CreatePropertyOwnerPage } from "../features/properties/CreatePropertyOwnerPage.js";
import { CreatePropertyPage } from "../features/properties/CreatePropertyPage.js";
import { PropertyDetailPage } from "../features/properties/PropertyDetailPage.js";
import { PropertyOwnerDetailPage } from "../features/properties/PropertyOwnerDetailPage.js";
import { PropertyOwnerDirectoryPage } from "../features/properties/PropertyOwnerDirectoryPage.js";
import { PropertyWorkspacePage } from "../features/properties/PropertyWorkspacePage.js";
import { PropertyCommercialJourneysPage } from "../features/properties/PropertyCommercialJourneysPage.js";
import { PlatformAgencyRegistrationsPage } from "../features/platform-agency-registrations/PlatformAgencyRegistrationsPage.js";
import { PlatformAgencyRegistrationReviewPage } from "../features/platform-agency-registrations/PlatformAgencyRegistrationReviewPage.js";
import { PlatformAgencyRegistrationReadBoundary } from "../features/platform-agency-registrations/PlatformAgencyRegistrationReadBoundary.js";
import { PublicPropertyCatalogPage } from "../features/public-catalog/PublicPropertyCatalogPage.js";
import { PublicPropertyDetailPage } from "../features/public-catalog/PublicPropertyDetailPage.js";
import { AuthenticationDiagnosticPage } from "./pages/AuthenticationDiagnosticPage.js";
import { HomePage } from "./pages/HomePage.js";
import { LoadingPage } from "./pages/LoadingPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { RouteErrorPage } from "./pages/RouteErrorPage.js";
import { ApplicationShell } from "./shell/ApplicationShell.js";

export const applicationRoutes: RouteObject[] = [
  { path: "/connexion", element: <LoginPage /> },
  { path: "/catalogue", element: <PublicPropertyCatalogPage />, errorElement: <RouteErrorPage /> },
  { path: "/inscription-agence", element: <PublicAgencyRegistrationPage />, errorElement: <RouteErrorPage /> },
  { path: "/catalogue/:publicPropertyId", element: <PublicPropertyDetailPage />, errorElement: <RouteErrorPage /> },
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
        { path: "demandes", element: <PropertyCommercialJourneysPage /> },
        {
          element: <PlatformAgencyRegistrationReadBoundary />,
          children: [
            {
              path: "plateforme/inscriptions-agences",
              element: <PlatformAgencyRegistrationsPage />,
            },
            {
              path: "plateforme/inscriptions-agences/:registrationId",
              element: <PlatformAgencyRegistrationReviewPage />,
            },
          ],
        },
        { path: "properties/new", element: <CreatePropertyPage /> },
        { path: "properties/:propertyId", element: <PropertyDetailPage /> },
        { path: "proprietaires", element: <PropertyOwnerDirectoryPage /> },
        { path: "proprietaires/new", element: <CreatePropertyOwnerPage /> },
        { path: "proprietaires/:ownerId", element: <PropertyOwnerDetailPage /> },
        { path: "diagnostic-authentification", element: <AuthenticationDiagnosticPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    }],
  },
];
