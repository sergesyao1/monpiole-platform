import { createBrowserRouter, RouterProvider } from "react-router";

import { Auth0SessionProvider } from "../auth/Auth0SessionProvider.js";
import { publicWebConfig } from "../config/public-config.js";
import { applicationRoutes } from "./routes.js";
const router = createBrowserRouter(applicationRoutes);

export function App() {
  return <Auth0SessionProvider config={publicWebConfig.oidc}><RouterProvider router={router} /></Auth0SessionProvider>;
}
