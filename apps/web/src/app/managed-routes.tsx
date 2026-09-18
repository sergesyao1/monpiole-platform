import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router";

import { HomePage } from "./pages/HomePage.js";
import { LoadingPage } from "./pages/LoadingPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { RouteErrorPage } from "./pages/RouteErrorPage.js";
import { ApplicationShell } from "./shell/ApplicationShell.js";

const lazyComponent = <TModule extends Record<TExport, ComponentType>, TExport extends string>(
  loader: () => Promise<TModule>,
  exportName: TExport,
) => async () => ({ Component: (await loader())[exportName] });

const applicationChildren: RouteObject[] = [{
  path: "/",
  element: <ApplicationShell />,
  errorElement: <RouteErrorPage />,
  hydrateFallbackElement: <LoadingPage />,
  children: [
    { index: true, element: <HomePage /> },
    { path: "biens", element: <Navigate to="/properties" replace /> },
    { path: "properties", lazy: lazyComponent(() => import("../features/properties/PropertyWorkspacePage.js"), "PropertyWorkspacePage") },
    { path: "demandes", lazy: lazyComponent(() => import("../features/properties/PropertyCommercialJourneysPage.js"), "PropertyCommercialJourneysPage") },
    {
      lazy: lazyComponent(
        () =>
          import(
            "../features/platform-agency-registrations/PlatformAgencyRegistrationReadBoundary.js"
          ),
        "PlatformAgencyRegistrationReadBoundary",
      ),
      children: [
        {
          path: "plateforme/inscriptions-agences",
          lazy: lazyComponent(
            () =>
              import(
                "../features/platform-agency-registrations/PlatformAgencyRegistrationsPage.js"
              ),
            "PlatformAgencyRegistrationsPage",
          ),
        },
        {
          path: "plateforme/inscriptions-agences/:registrationId",
          lazy: lazyComponent(
            () =>
              import(
                "../features/platform-agency-registrations/PlatformAgencyRegistrationReviewPage.js"
              ),
            "PlatformAgencyRegistrationReviewPage",
          ),
        },
      ],
    },
    { path: "properties/new", lazy: lazyComponent(() => import("../features/properties/CreatePropertyPage.js"), "CreatePropertyPage") },
    { path: "properties/:propertyId", lazy: lazyComponent(() => import("../features/properties/PropertyDetailPage.js"), "PropertyDetailPage") },
    { path: "proprietaires", lazy: lazyComponent(() => import("../features/properties/PropertyOwnerDirectoryPage.js"), "PropertyOwnerDirectoryPage") },
    { path: "proprietaires/new", lazy: lazyComponent(() => import("../features/properties/CreatePropertyOwnerPage.js"), "CreatePropertyOwnerPage") },
    { path: "proprietaires/:ownerId", lazy: lazyComponent(() => import("../features/properties/PropertyOwnerDetailPage.js"), "PropertyOwnerDetailPage") },
    { path: "diagnostic-authentification", lazy: lazyComponent(() => import("./pages/AuthenticationDiagnosticPage.js"), "AuthenticationDiagnosticPage") },
    { path: "*", element: <NotFoundPage /> },
  ],
}];

export const managedApplicationRoutes: RouteObject[] = [
  { path: "/connexion", lazy: lazyComponent(() => import("../auth/ManagedLoginPage.js"), "ManagedLoginPage"), hydrateFallbackElement: <LoadingPage /> },
  {
    path: "/catalogue",
    lazy: lazyComponent(() => import("../features/public-catalog/PublicPropertyCatalogPage.js"), "PublicPropertyCatalogPage"),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <LoadingPage />,
  },
  {
    path: "/inscription-agence",
    lazy: lazyComponent(() => import("../features/agency-registration/PublicAgencyRegistrationPage.js"), "PublicAgencyRegistrationPage"),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <LoadingPage />,
  },
  {
    path: "/catalogue/:publicPropertyId",
    lazy: lazyComponent(() => import("../features/public-catalog/PublicPropertyDetailPage.js"), "PublicPropertyDetailPage"),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <LoadingPage />,
  },
  {
    lazy: lazyComponent(() => import("../auth/ManagedAuthenticationBoundary.js"), "ManagedAuthenticationBoundary"),
    hydrateFallbackElement: <LoadingPage />,
    children: applicationChildren,
  },
];
