import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useParams } from "react-router";

import { useSession } from "../../auth/session.js";
import { ApiForbiddenError } from "../../infrastructure/http/api-client.js";
import {
  Alert,
  Button,
  Field,
  LoadingState,
  PageHeader,
  StatusBadge,
  buttonClassName,
} from "../../ui/index.js";
import { createPlatformAgencyRegistrationApi } from "./platform-agency-registration-api.js";
import type {
  PlatformAgencyRegistrationDetails,
  PlatformAgencyRegistrationDocument,
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

export function PlatformAgencyRegistrationReviewPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const session = useSession();

  const api = useMemo(
    () => createPlatformAgencyRegistrationApi(session),
    [session],
  );

  const [registration, setRegistration] =
    useState<PlatformAgencyRegistrationDetails>();
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<
    "review" | "approve" | "reject" | undefined
  >();
  const [downloadingDocumentId, setDownloadingDocumentId] =
    useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  async function load() {
    if (!registrationId) {
      setError("Identifiant d'inscription agence manquant.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      setRegistration(
        await api.retrieveRegistration(registrationId),
      );
    } catch {
      setError(
        "Impossible de charger le dossier d'inscription agence. Vérifiez vos autorisations plateforme puis réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [api, registrationId]);

  async function startReview() {
    if (!registrationId || busyAction) return;

    setBusyAction("review");
    setError(undefined);
    setSuccess(undefined);

    try {
      const updated = await api.startReview(registrationId);

      setRegistration((current) =>
        current
          ? { ...current, ...updated }
          : undefined,
      );
      setSuccess("La revue du dossier a commencé.");
    } catch (error) {
      setError(
        error instanceof ApiForbiddenError
          ? "Vous n’êtes pas autorisé à commencer la revue de cette inscription agence."
          : "Impossible de commencer la revue. Le dossier a peut-être déjà changé d'état ou vous ne disposez pas de l'autorisation requise.",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  async function approve() {
    if (!registrationId || busyAction) return;

    if (
      !window.confirm(
        "Confirmer l'approbation de cette inscription agence ?",
      )
    ) {
      return;
    }

    setBusyAction("approve");
    setError(undefined);
    setSuccess(undefined);

    try {
      const updated = await api.approveRegistration(registrationId);

      setRegistration((current) =>
        current
          ? { ...current, ...updated }
          : undefined,
      );
      setShowRejectionForm(false);
      setSuccess("L'inscription agence a été approuvée.");
    } catch (error) {
      setError(
        error instanceof ApiForbiddenError
          ? "Vous n’êtes pas autorisé à prendre une décision sur cette inscription agence."
          : "Impossible d'approuver l'inscription. Vérifiez l'état du dossier et vos autorisations plateforme.",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!registrationId || busyAction) return;

    const form = new FormData(event.currentTarget);
    const rejectionReason = String(
      form.get("rejectionReason") ?? "",
    ).trim();

    if (!rejectionReason) {
      setError("Le motif de rejet est obligatoire.");
      return;
    }

    if (rejectionReason.length > 2000) {
      setError(
        "Le motif de rejet ne peut pas dépasser 2 000 caractères.",
      );
      return;
    }

    if (
      !window.confirm(
        "Confirmer le rejet de cette inscription agence ?",
      )
    ) {
      return;
    }

    setBusyAction("reject");
    setError(undefined);
    setSuccess(undefined);

    try {
      const updated = await api.rejectRegistration(
        registrationId,
        { rejectionReason },
      );

      setRegistration((current) =>
        current
          ? { ...current, ...updated }
          : undefined,
      );
      setShowRejectionForm(false);
      setSuccess("L'inscription agence a été rejetée.");
    } catch (error) {
      setError(
        error instanceof ApiForbiddenError
          ? "Vous n’êtes pas autorisé à prendre une décision sur cette inscription agence."
          : "Impossible de rejeter l'inscription. Vérifiez l'état du dossier et vos autorisations plateforme.",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  async function downloadDocument(
    document: PlatformAgencyRegistrationDocument,
  ) {
    if (!registrationId || downloadingDocumentId) return;

    setDownloadingDocumentId(document.documentId);
    setError(undefined);

    try {
      const blob = await api.downloadDocument(
        registrationId,
        document.documentId,
      );

      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");

      anchor.href = url;
      anchor.download = document.originalFilename;
      anchor.style.display = "none";

      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      setError(
        error instanceof ApiForbiddenError
          ? "Vous n’êtes pas autorisé à télécharger ce justificatif."
          : "Impossible de télécharger ce justificatif. Vérifiez vos autorisations plateforme puis réessayez.",
      );
    } finally {
      setDownloadingDocumentId(undefined);
    }
  }

  if (loading && !registration) {
    return (
      <div className="page-stack">
        <LoadingState label="Chargement du dossier agence…" />
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Administration plateforme"
          title="Dossier d'inscription agence"
          description="Examen d'une demande d'accès à MonPiole."
        />

        {error && (
          <Alert tone="danger" title="Dossier indisponible">
            <p>{error}</p>
            <Button variant="secondary" onClick={() => void load()}>
              Réessayer
            </Button>
          </Alert>
        )}

        <Link
          className={buttonClassName("secondary")}
          to="/plateforme/inscriptions-agences"
        >
          Retour aux inscriptions
        </Link>
      </div>
    );
  }

  const agencyName =
    registration.agencyTradeName?.trim() ||
    registration.agencyLegalName;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administration plateforme"
        title={agencyName}
        description="Vérifiez les informations et justificatifs avant de prendre une décision."
      />

      <div>
        <Link
          className={buttonClassName("secondary", "inline-action")}
          to="/plateforme/inscriptions-agences"
        >
          Retour aux inscriptions
        </Link>
      </div>

      {error && (
        <Alert tone="danger" title="Action impossible">
          <p>{error}</p>
        </Alert>
      )}

      {success && (
        <Alert tone="success" title={success} />
      )}

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">État du dossier</p>
            <h2>Revue de l'inscription</h2>
          </div>

          <StatusBadge tone={statusTones[registration.status]}>
            {statusLabels[registration.status]}
          </StatusBadge>
        </div>

        <dl>
          <dt>Soumise le</dt>
          <dd>
            {new Date(registration.submittedAt).toLocaleString(
              "fr-FR",
            )}
          </dd>

          {registration.reviewStartedAt && (
            <>
              <dt>Revue commencée le</dt>
              <dd>
                {new Date(
                  registration.reviewStartedAt,
                ).toLocaleString("fr-FR")}
              </dd>
            </>
          )}

          {registration.approvedAt && (
            <>
              <dt>Approuvée le</dt>
              <dd>
                {new Date(
                  registration.approvedAt,
                ).toLocaleString("fr-FR")}
              </dd>
            </>
          )}

          {registration.rejectedAt && (
            <>
              <dt>Rejetée le</dt>
              <dd>
                {new Date(
                  registration.rejectedAt,
                ).toLocaleString("fr-FR")}
              </dd>
            </>
          )}
        </dl>

        {registration.rejectionReason && (
          <Alert tone="danger" title="Motif du rejet">
            <p>{registration.rejectionReason}</p>
          </Alert>
        )}

        {registration.status === "SUBMITTED" && (
          <div className="form-actions">
            <Button
              loading={busyAction === "review"}
              loadingLabel="Démarrage de la revue…"
              onClick={() => void startReview()}
            >
              Commencer la revue
            </Button>
          </div>
        )}

        {registration.status === "UNDER_REVIEW" && (
          <div className="form-actions">
            <Button
              loading={busyAction === "approve"}
              loadingLabel="Approbation…"
              disabled={busyAction !== undefined}
              onClick={() => void approve()}
            >
              Approuver
            </Button>

            <Button
              variant="danger"
              disabled={busyAction !== undefined}
              onClick={() => {
                setError(undefined);
                setSuccess(undefined);
                setShowRejectionForm(true);
              }}
            >
              Rejeter
            </Button>
          </div>
        )}

        {registration.status === "UNDER_REVIEW" &&
          showRejectionForm && (
            <form className="compact-form" onSubmit={reject}>
              <Field
                label="Motif du rejet"
                help="Expliquez clairement la raison de la décision."
              >
                <textarea
                  name="rejectionReason"
                  required
                  maxLength={2000}
                  rows={5}
                />
              </Field>

              <div className="form-actions">
                <Button
                  variant="danger"
                  type="submit"
                  loading={busyAction === "reject"}
                  loadingLabel="Rejet en cours…"
                >
                  Confirmer le rejet
                </Button>

                <Button
                  variant="secondary"
                  disabled={busyAction !== undefined}
                  onClick={() => setShowRejectionForm(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          )}
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agence</p>
            <h2>Informations légales</h2>
          </div>
        </div>

        <dl>
          <dt>Raison sociale</dt>
          <dd>{registration.agencyLegalName}</dd>

          {registration.agencyTradeName && (
            <>
              <dt>Nom commercial</dt>
              <dd>{registration.agencyTradeName}</dd>
            </>
          )}

          <dt>Numéro d'immatriculation</dt>
          <dd>{registration.registrationNumber}</dd>

          {registration.taxIdentifier && (
            <>
              <dt>Identifiant fiscal</dt>
              <dd>{registration.taxIdentifier}</dd>
            </>
          )}

          <dt>Téléphone</dt>
          <dd>{registration.phone}</dd>

          <dt>Email</dt>
          <dd>
            <a href={`mailto:${registration.email}`}>
              {registration.email}
            </a>
          </dd>

          {registration.website && (
            <>
              <dt>Site web</dt>
              <dd>{registration.website}</dd>
            </>
          )}

          <dt>Adresse</dt>
          <dd>{registration.address}</dd>

          <dt>Ville</dt>
          <dd>{registration.city}</dd>

          <dt>Pays</dt>
          <dd>{registration.countryCode}</dd>
        </dl>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Contact principal</p>
            <h2>Responsable de la demande</h2>
          </div>
        </div>

        <dl>
          <dt>Nom</dt>
          <dd>
            {registration.contactFirstName}{" "}
            {registration.contactLastName}
          </dd>

          <dt>Email</dt>
          <dd>
            <a href={`mailto:${registration.contactEmail}`}>
              {registration.contactEmail}
            </a>
          </dd>

          <dt>Téléphone</dt>
          <dd>{registration.contactPhone}</dd>
        </dl>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vérification</p>
            <h2>Justificatifs</h2>
          </div>
        </div>

        {registration.documents.length === 0 ? (
          <Alert
            tone="warning"
            title="Aucun justificatif disponible"
          >
            <p>
              Aucun document n'est actuellement associé à cette
              inscription.
            </p>
          </Alert>
        ) : (
          <ul className="inquiry-list">
            {registration.documents.map((document) => (
              <li key={document.documentId}>
                <div>
                  <strong>{document.documentType}</strong>
                  <p>{document.originalFilename}</p>
                  <p>
                    {document.mimeType} ·{" "}
                    {formatFileSize(document.sizeBytes)}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  loading={
                    downloadingDocumentId === document.documentId
                  }
                  loadingLabel="Téléchargement…"
                  disabled={
                    downloadingDocumentId !== undefined &&
                    downloadingDocumentId !== document.documentId
                  }
                  onClick={() =>
                    void downloadDocument(document)
                  }
                >
                  Télécharger
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} o`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} Ko`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} Mo`;
}