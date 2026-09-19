import { Auth0SessionProvider } from "../../auth/Auth0SessionProvider.js";
import { publicWebConfig } from "../../config/public-config.js";
import { AgencyAdministratorActivationPage } from "./AgencyAdministratorActivationPage.js";

export function ManagedAgencyAdministratorActivationPage() {
  return <Auth0SessionProvider config={publicWebConfig.oidc}><AgencyAdministratorActivationPage /></Auth0SessionProvider>;
}
