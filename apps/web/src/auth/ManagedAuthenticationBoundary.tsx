import { Auth0SessionProvider } from "./Auth0SessionProvider.js";
import { AuthenticationBoundary } from "./AuthenticationBoundary.js";
import { publicWebConfig } from "../config/public-config.js";

export function ManagedAuthenticationBoundary() {
  return (
    <Auth0SessionProvider config={publicWebConfig.oidc}>
      <AuthenticationBoundary />
    </Auth0SessionProvider>
  );
}
