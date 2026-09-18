import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useSession } from "../../auth/session.js";
import {
  Alert,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  buttonClassName,
} from "../../ui/index.js";
import { createPlatformAgencyRegistrationApi } from "./platform-agency-registration-api.js";
import type {
  PlatformAgencyRegistration,
  PlatformAgencyRegistrationStatus,
} from "./platform-agency-registration-model.js";

const statusLabels: Record<PlatformAgencyRegistrationStatus, string> = {
  SUBMITTED: "À examiner",
  UNDER_REVIEW: "En cours de revue",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
};

const statusTones = {
  SUBMITTED: "warning",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

export function PlatformAgencyRegistrationsPage() {
  const session = useSession();
  const api = useMemo(
    () => createPlatformAgencyRegistrationApi(session),
    [session],
  );

  const [items, setItems] =
    useState<readonly PlatformAgencyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);

    try {
      const result = await api.listRegistrations();
      setItems(result.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administration plateforme"
        title="Inscriptions agences"
        description="Examinez les demandes d'inscription des agences avant leur activation sur MonPiole."
      />

      <section
        className="content-panel"
        aria-labelledby="platform-agency-registrations-title"
        aria-busy={loading}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Onboarding agences</p>
            <h2 id="platform-agency-registrations-title">
              Demandes reçues
            </h2>
          </div>
        </div>

        {error && (
          <Alert
            tone="danger"
            title="Impossible de charger les inscriptions agences"
          >
            <p>
              Vérifiez votre connexion et vos autorisations plateforme,
              puis réessayez.
            </p>
            <button
              className={buttonClassName("secondary")}
              type="button"
              onClick={() => void load()}
            >
              Réessayer
            </button>
          </Alert>
        )}

        {loading && items.length === 0 ? (
          <LoadingState label="Chargement des inscriptions agences…" />
        ) : items.length === 0 && !error ? (
          <EmptyState
            title="Aucune inscription agence à examiner."
            description="Les nouvelles demandes soumises apparaîtront ici."
          />
        ) : (
          <ul className="inquiry-list">
            {items.map((registration) => (
              <RegistrationItem
                key={registration.registrationId}
                registration={registration}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RegistrationItem({
  registration,
}: Readonly<{
  registration: PlatformAgencyRegistration;
}>) {
  const agencyName =
    registration.agencyTradeName?.trim() ||
    registration.agencyLegalName;

  const contactName =
    `${registration.contactFirstName} ${registration.contactLastName}`.trim();

  return (
    <li>
      <div>
        <strong>{agencyName}</strong>
        <p>{registration.agencyLegalName}</p>
        <p>
          {registration.city} · {registration.countryCode}
        </p>
        <p>
          Contact : {contactName} · {registration.contactEmail}
        </p>
        <p>
          Soumise le{" "}
          {new Date(registration.submittedAt).toLocaleString("fr-FR")}
        </p>
      </div>

      <div>
        <StatusBadge tone={statusTones[registration.status]}>
          {statusLabels[registration.status]}
        </StatusBadge>

        <Link
          className={buttonClassName("secondary", "inline-action")}
          to={`/plateforme/inscriptions-agences/${registration.registrationId}`}
        >
          Ouvrir
        </Link>
      </div>
    </li>
  );
}