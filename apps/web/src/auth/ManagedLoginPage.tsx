import { publicWebConfig } from "../config/public-config.js";
import { Auth0SessionProvider } from "./Auth0SessionProvider.js";
import { LoginPage } from "./LoginPage.js";

export function ManagedLoginPage() {
  return (
    <Auth0SessionProvider config={publicWebConfig.oidc}>
      <LoginPage />
    </Auth0SessionProvider>
  );
}
