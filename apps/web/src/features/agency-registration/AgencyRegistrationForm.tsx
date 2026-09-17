import { type FormEvent, useRef, useState } from "react";

import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import { Alert, Button, Field } from "../../ui/index.js";

import type { AgencyRegistrationApi } from "./agency-registration-api.js";
import type { AgencyRegistrationSubmission } from "./agency-registration-model.js";

type SubmissionState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | { readonly kind: "success"; readonly submission: AgencyRegistrationSubmission }
  | { readonly kind: "error"; readonly message: string };

const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
]);

export function AgencyRegistrationForm({
  api,
}: Readonly<{
  api: AgencyRegistrationApi;
}>) {
  const formRef = useRef<HTMLFormElement>(null);
  const documentRef = useRef<File | null>(null);
  const [state, setState] = useState<SubmissionState>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.kind === "saving") return;

    const data = new FormData(event.currentTarget);
    const document = documentRef.current;

    if (document === null || document.size === 0) {
      setState({
        kind: "error",
        message: "Ajoutez un justificatif d'immatriculation de votre agence.",
      });
      return;
    }

    if (!ACCEPTED_DOCUMENT_TYPES.has(document.type)) {
      setState({
        kind: "error",
        message: "Le justificatif doit être un fichier PDF ou JPEG.",
      });
      return;
    }

    if (document.size > MAX_DOCUMENT_SIZE_BYTES) {
      setState({
        kind: "error",
        message: "Le justificatif ne doit pas dépasser 50 Mo.",
      });
      return;
    }

    setState({ kind: "saving" });

    try {
      const upload = await api.uploadDocument(document);

      const submission = await api.submitRegistration({
        agencyLegalName: requiredValue(data, "agencyLegalName"),
        ...optionalValue(data, "agencyTradeName"),
        registrationNumber: requiredValue(data, "registrationNumber"),
        ...optionalValue(data, "taxIdentifier"),
        phone: requiredValue(data, "phone"),
        email: requiredValue(data, "email"),
        ...optionalValue(data, "website"),
        address: requiredValue(data, "address"),
        city: requiredValue(data, "city"),
        countryCode: requiredValue(data, "countryCode").toUpperCase(),
        contactFirstName: requiredValue(data, "contactFirstName"),
        contactLastName: requiredValue(data, "contactLastName"),
        contactEmail: requiredValue(data, "contactEmail"),
        contactPhone: requiredValue(data, "contactPhone"),
        documents: [
          {
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId: upload.uploadId,
          },
        ],
      });

      setState({ kind: "success", submission });
      documentRef.current = null;
      formRef.current?.reset();
    } catch (error) {
      setState({
        kind: "error",
        message: registrationErrorMessage(error),
      });
    }
  }

  if (state.kind === "success") {
    return (
      <section
        className="public-agency-registration__form"
        aria-labelledby="agency-registration-success-title"
      >
        <Alert
          tone="success"
          title="Votre demande d'inscription a bien été transmise"
        >
          <p id="agency-registration-success-title">
            L'équipe MonPiole va examiner les informations et justificatifs
            fournis avant l'activation de votre agence.
          </p>
          <p>
            Référence de la demande :{" "}
            <strong>{state.submission.registrationId}</strong>
          </p>
        </Alert>
      </section>
    );
  }

  return (
    <section
      className="public-agency-registration__form"
      aria-labelledby="agency-registration-form-title"
    >
      <div className="public-section-heading">
        <div>
          <p className="eyebrow">Demande d'inscription</p>
          <h2 id="agency-registration-form-title">Informations de l'agence</h2>
        </div>
      </div>

      {state.kind === "error" && (
        <Alert tone="danger" title="La demande n'a pas été envoyée">
          <p>{state.message}</p>
        </Alert>
      )}

      <form
        ref={formRef}
        className="form-stack"
        onSubmit={(event) => void submit(event)}
      >
        <div className="form-grid agency-registration-grid">
          <Field label="Raison sociale">
            <input
              name="agencyLegalName"
              required
              maxLength={255}
              autoComplete="organization"
            />
          </Field>

          <Field label="Nom commercial" optional>
            <input
              name="agencyTradeName"
              maxLength={255}
            />
          </Field>
        </div>

        <div className="form-grid agency-registration-grid">
          <Field label="Numéro d'immatriculation">
            <input
              name="registrationNumber"
              required
              maxLength={100}
            />
          </Field>

          <Field label="Identifiant fiscal" optional>
            <input
              name="taxIdentifier"
              maxLength={100}
            />
          </Field>
        </div>

        <div className="form-grid agency-registration-grid">
          <Field label="Téléphone de l'agence">
            <input
              name="phone"
              type="tel"
              required
              maxLength={50}
              autoComplete="tel"
            />
          </Field>

          <Field label="E-mail de l'agence">
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
            />
          </Field>
        </div>

        <Field label="Site web" optional>
          <input
            name="website"
            type="url"
            maxLength={2048}
            placeholder="https://"
          />
        </Field>

        <Field label="Adresse">
          <input
            name="address"
            required
            maxLength={500}
            autoComplete="street-address"
          />
        </Field>

        <div className="form-grid agency-registration-grid">
          <Field label="Ville">
            <input
              name="city"
              required
              maxLength={150}
              autoComplete="address-level2"
            />
          </Field>

          <Field
            label="Code pays"
            help="Code ISO sur 2 lettres, par exemple CI."
          >
            <input
              name="countryCode"
              required
              minLength={2}
              maxLength={2}
              pattern="[A-Za-z]{2}"
              defaultValue="CI"
              autoComplete="country"
            />
          </Field>
        </div>

        <div className="public-agency-registration__section">
          <h3>Contact principal</h3>
          <p>
            Cette personne pourra être contactée par MonPiole pendant
            l'examen de la demande.
          </p>
        </div>

        <div className="form-grid agency-registration-grid">
          <Field label="Prénom">
            <input
              name="contactFirstName"
              required
              maxLength={150}
              autoComplete="given-name"
            />
          </Field>

          <Field label="Nom">
            <input
              name="contactLastName"
              required
              maxLength={150}
              autoComplete="family-name"
            />
          </Field>
        </div>

        <div className="form-grid agency-registration-grid">
          <Field label="E-mail du contact">
            <input
              name="contactEmail"
              type="email"
              required
              maxLength={320}
            />
          </Field>

          <Field label="Téléphone du contact">
            <input
              name="contactPhone"
              type="tel"
              required
              maxLength={50}
            />
          </Field>
        </div>

        <div className="public-agency-registration__section">
          <h3>Justificatif</h3>
          <p>
            Ajoutez un document permettant de vérifier l'immatriculation
            de l'agence.
          </p>
        </div>

        <Field
          label="Justificatif d'immatriculation"
          help="PDF ou JPEG, 50 Mo maximum."
        >
          <input
            name="registrationDocument"
            type="file"
            required
            accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
            onChange={(event) => {
              documentRef.current = event.currentTarget.files?.[0] ?? null;
            }}
          />
        </Field>

        <label className="checkbox-field">
          <input
            name="confirmation"
            type="checkbox"
            required
          />
          Je confirme que les informations transmises sont exactes et que
          je suis autorisé à effectuer cette demande pour cette agence.
        </label>

        <div className="form-actions">
          <Button
            type="submit"
            loading={state.kind === "saving"}
            loadingLabel="Transmission en cours…"
          >
            Envoyer la demande d'inscription
          </Button>
        </div>
      </form>
    </section>
  );
}

function requiredValue(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

function optionalValue(
  data: FormData,
  key: string,
): Record<string, string> {
  const value = requiredValue(data, key);
  return value.length === 0 ? {} : { [key]: value };
}

function registrationErrorMessage(error: unknown): string {
  if (error instanceof ApiProblem) {
    if (error.problem.status === 409) {
      return "Une demande existe déjà avec certaines de ces informations ou ce justificatif n'est plus utilisable.";
    }

    if (error.problem.status === 413) {
      return "Le justificatif dépasse la taille maximale autorisée.";
    }

    if (error.problem.status === 400) {
      return "Certaines informations ou le justificatif transmis ne sont pas valides.";
    }
  }

  return "Une erreur est survenue pendant la transmission. Veuillez réessayer.";
}
