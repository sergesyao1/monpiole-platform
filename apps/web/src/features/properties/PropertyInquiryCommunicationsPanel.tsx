import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Alert,
  Button,
  EmptyState,
  LoadingState,
  StatusBadge,
} from "../../ui/index.js";
import {
  ApiForbiddenError,
  ApiSessionExpiredError,
} from "../../infrastructure/http/api-client.js";
import {
  ApiProblem,
} from "../../infrastructure/http/problem-details.js";
import type {
  PropertyInquiryApi,
} from "./property-api.js";
import type {
  PropertyInquiryCommunication,
  PropertyInquiryCommunicationChannel,
  PropertyInquiryCommunicationDirection,
  RecordPropertyInquiryCommunicationInput,
} from "./property-model.js";

export function PropertyInquiryCommunicationsPanel({
  propertyId,
  inquiryId,
  api,
  readOnly = false,
}: Readonly<{
  propertyId: string;
  inquiryId: string;
  api: PropertyInquiryApi;
  readOnly?: boolean;
}>) {
  const [items, setItems] =
    useState<readonly PropertyInquiryCommunication[]>([]);
  const [cursor, setCursor] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [busy, setBusy] =
    useState(false);
  const [editing, setEditing] =
    useState(false);
  const [message, setMessage] =
    useState<string>();

  async function load(next?: string) {
    setLoading(true);
    setMessage(undefined);

    try {
      const page =
        await api.listPropertyInquiryCommunications(
          propertyId,
          inquiryId,
          next,
        );

      setItems((current) =>
        next === undefined
          ? page.items
          : [
              ...new Map(
                [...current, ...page.items].map(
                  (item) => [
                    item.communicationId,
                    item,
                  ],
                ),
              ).values(),
            ],
      );

      setCursor(page.pageInfo.nextCursor);
    } catch (error) {
      setMessage(errorMessage(error, "load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId, inquiryId]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = values(form);
    const validation = validate(input);

    if (validation !== undefined) {
      setMessage(validation);
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const created =
        await api.recordPropertyInquiryCommunication(
          propertyId,
          inquiryId,
          input,
        );

      setItems((current) => [
        created,
        ...current.filter(
          (item) =>
            item.communicationId !==
            created.communicationId,
        ),
      ]);

      formElement.reset();
      setEditing(false);
      setMessage("Échange enregistré.");
    } catch (error) {
      setMessage(errorMessage(error, "record"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="inquiry-communications"
      aria-label="Historique des échanges"
    >
      <div className="section-heading">
        <div>
          <h4>Historique des échanges</h4>
        </div>

        {!readOnly && !editing ? (
          <Button
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            Enregistrer un échange
          </Button>
        ) : null}
      </div>

      {message ? (
        <Alert
          tone={
            message === "Échange enregistré."
              ? "info"
              : "danger"
          }
          title={message}
        />
      ) : null}

      {!readOnly && editing ? (
        <form
          className="inquiry-communication-form"
          onSubmit={submit}
          noValidate
        >
          <label>
            Canal
            <select
              name="channel"
              defaultValue="PHONE"
            >
              <option value="PHONE">
                Appel téléphonique
              </option>
              <option value="SMS">
                SMS
              </option>
              <option value="EMAIL">
                E-mail
              </option>
            </select>
          </label>

          <label>
            Sens
            <select
              name="direction"
              defaultValue="OUTBOUND"
            >
              <option value="OUTBOUND">
                Sortant
              </option>
              <option value="INBOUND">
                Entrant
              </option>
            </select>
          </label>

          <label>
            Date et heure
            <input
              name="occurredAt"
              type="datetime-local"
            />
          </label>

          <label>
            Note
            <textarea
              name="summary"
              maxLength={2000}
              placeholder="Ex. Client joint, visite à confirmer."
            />
          </label>

          <div className="viewing-actions">
            <Button
              type="submit"
              loading={busy}
            >
              Enregistrer
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setMessage(undefined);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      {loading && items.length === 0 ? (
        <LoadingState label="Chargement des échanges…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Aucun échange enregistré"
          description="Les appels, SMS et e-mails échangés avec ce prospect apparaîtront ici."
        />
      ) : (
        <ul className="inquiry-communication-list">
          {items.map((item) => (
            <li key={item.communicationId}>
              <div>
                <strong>
                  {channelLabel(item.channel)}
                  {" · "}
                  {directionLabel(item.direction)}
                </strong>

                <p>
                  {formatDate(item.occurredAt)}
                </p>

                {item.summary ? (
                  <p>{item.summary}</p>
                ) : null}

                <p>
                  Par {item.performedByActorId}
                </p>
              </div>

              <StatusBadge>
                {statusLabel(item.status)}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <Button
          variant="secondary"
          loading={loading}
          onClick={() => void load(cursor)}
        >
          Afficher plus d’échanges
        </Button>
      ) : null}
    </section>
  );
}

function values(
  form: FormData,
): RecordPropertyInquiryCommunicationInput {
  const channel =
    String(
      form.get("channel") ?? "",
    ) as PropertyInquiryCommunicationChannel;

  const direction =
    String(
      form.get("direction") ?? "",
    ) as PropertyInquiryCommunicationDirection;

  const summary =
    String(
      form.get("summary") ?? "",
    ).trim();

  const occurredAtInput =
    String(
      form.get("occurredAt") ?? "",
    ).trim();

  return {
    channel,
    direction,
    ...(summary === ""
      ? {}
      : { summary }),
    ...(occurredAtInput === ""
      ? {}
      : {
          occurredAt:
            toInstant(occurredAtInput),
        }),
  };
}

function validate(
  input: RecordPropertyInquiryCommunicationInput,
): string | undefined {
  if (
    !["PHONE", "SMS", "EMAIL"].includes(
      input.channel,
    )
  ) {
    return "Le canal de communication est invalide.";
  }

  if (
    !["OUTBOUND", "INBOUND"].includes(
      input.direction,
    )
  ) {
    return "Le sens de communication est invalide.";
  }

  if (
    input.summary !== undefined &&
    input.summary.length > 2000
  ) {
    return "La note ne peut pas dépasser 2 000 caractères.";
  }

  if (
    input.occurredAt !== undefined &&
    !Number.isFinite(
      Date.parse(input.occurredAt),
    )
  ) {
    return "La date et l’heure sont invalides.";
  }

  if (
    input.occurredAt !== undefined &&
    Date.parse(input.occurredAt) >
      Date.now()
  ) {
    return "La date de l’échange ne peut pas être dans le futur.";
  }

  return undefined;
}

function toInstant(
  value: string,
): string {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : "";
}

function channelLabel(
  channel: PropertyInquiryCommunicationChannel,
) {
  return channel === "PHONE"
    ? "Appel"
    : channel === "SMS"
      ? "SMS"
      : "E-mail";
}

function directionLabel(
  direction: PropertyInquiryCommunicationDirection,
) {
  return direction === "OUTBOUND"
    ? "sortant"
    : "entrant";
}

function statusLabel(
  status: PropertyInquiryCommunication["status"],
) {
  return status === "RECORDED"
    ? "Consigné"
    : status === "SENT"
      ? "Envoyé"
      : "Échec";
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function errorMessage(
  error: unknown,
  operation: "load" | "record",
) {
  if (
    error instanceof
    ApiSessionExpiredError
  ) {
    return "Votre session a expiré. Veuillez vous reconnecter.";
  }

  if (
    error instanceof
    ApiForbiddenError
  ) {
    return operation === "record"
      ? "Vous n’êtes pas autorisé à enregistrer un échange."
      : "Vous n’êtes pas autorisé à consulter les échanges.";
  }

  if (
    error instanceof ApiProblem &&
    error.problem.status === 404
  ) {
    return "La demande est introuvable.";
  }

  return operation === "record"
    ? "Impossible d’enregistrer l’échange. Réessayez."
    : "Impossible de charger les échanges. Réessayez.";
}