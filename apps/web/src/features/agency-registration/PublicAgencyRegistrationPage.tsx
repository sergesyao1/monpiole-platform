import { PublicCatalogLayout } from "../public-catalog/PublicCatalogLayout.js";
import { createAgencyRegistrationApi } from "./agency-registration-api.js";
import { AgencyRegistrationForm } from "./AgencyRegistrationForm.js";

const api = createAgencyRegistrationApi();

export function PublicAgencyRegistrationPage() {
  return (
    <PublicCatalogLayout>
      <div className="public-agency-registration">
        <header className="public-agency-registration__header">
          <p className="eyebrow">Professionnels de l'immobilier</p>
          <h1>Inscrire votre agence sur MonPiole</h1>
          <p>
            Transmettez les informations de votre agence et un justificatif.
            L'équipe MonPiole examinera votre demande avant toute activation.
          </p>
        </header>

        <AgencyRegistrationForm api={api} />
      </div>
    </PublicCatalogLayout>
  );
}
