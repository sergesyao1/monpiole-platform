import { Outlet } from "react-router";

import { publicWebConfig } from "../config/public-config.js";
import { Auth0SessionProvider } from "./Auth0SessionProvider.js";

export function ManagedAuth0SessionBoundary() {
  return (
    <Auth0SessionProvider config={publicWebConfig.oidc}>
      <Outlet />
    </Auth0SessionProvider>
  );
}
