import {
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
import type {
  PropertyInquiryApi,
} from "./property-api.js";
import type {
  PropertyInquiry,
} from "./property-model.js";
import {
  PropertyInquiryCommunicationsPanel,
} from "./PropertyInquiryCommunicationsPanel.js";
import {
  PropertyViewingPanel,
} from "./PropertyViewingPanel.js";

export function PropertyInquiriesSection({
  propertyId,
  api,
}: Readonly<{
  propertyId: string;
  api: PropertyInquiryApi;
}>) {
  const [items, setItems] =
    useState<readonly PropertyInquiry[]>([]);
  const [cursor, setCursor] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState(false);

  async function load(next?: string) {
    setLoading(true);
    setError(false);

    try {
      const page =
        await api.listPropertyInquiries(
          propertyId,
          next,
        );

      if (
        !page ||
        !Array.isArray(page.items) ||
        !page.pageInfo
      ) {
        return;
      }

      setItems((current) =>
        next === undefined
          ? page.items
          : [
              ...new Map(
                [...current, ...page.items].map(
                  (item) => [
                    item.inquiryId,
                    item,
                  ],
                ),
              ).values(),
            ],
      );

      setCursor(
        page.pageInfo.nextCursor,
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  async function transition(
    item: PropertyInquiry,
    kind: "ack" | "close",
  ) {
    try {
      const changed =
        kind === "ack"
          ? await api.acknowledgePropertyInquiry(
              propertyId,
              item.inquiryId,
            )
          : await api.closePropertyInquiry(
              propertyId,
              item.inquiryId,
            );

      setItems((current) =>
        current.map((candidate) =>
          candidate.inquiryId ===
          changed.inquiryId
            ? changed
            : candidate,
        ),
      );
    } catch {
      setError(true);
    }
  }

  return (
    <section
      className="content-panel"
      id="property-inquiries"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            Suivi commercial
          </p>
          <h2>Demandes reçues</h2>
        </div>
      </div>

      {error ? (
        <Alert
          tone="danger"
          title="Impossible de charger ou mettre à jour les demandes"
        >
          <Button
            onClick={() =>
              void load()
            }
          >
            Réessayer
          </Button>
        </Alert>
      ) : null}

      {loading &&
      items.length === 0 ? (
        <LoadingState label="Chargement des demandes…" />
      ) : items.length === 0 &&
        !error ? (
        <EmptyState
          title="Aucune demande"
          description="Les demandes envoyées depuis la fiche publique apparaîtront ici."
        />
      ) : (
        <ul className="inquiry-list">
          {items.map((item) => (
            <li
              key={item.inquiryId}
              className="inquiry-card"
            >
              <div className="inquiry-card__main">
                <div className="inquiry-card__header">
                  <div>
                    <p className="eyebrow">
                      {intentLabel(
                        item.intent,
                      )}
                    </p>

                    <h3>
                      {item.contactName}
                    </h3>
                  </div>

                  <StatusBadge>
                    {statusLabel(
                      item.status,
                    )}
                  </StatusBadge>
                </div>

                <div className="inquiry-contact-details">
                  {item.phoneNumber ? (
                    <p>
                      <strong>
                        Téléphone :
                      </strong>{" "}
                      {item.phoneNumber}
                    </p>
                  ) : null}

                  {item.email ? (
                    <p>
                      <strong>
                        E-mail :
                      </strong>{" "}
                      {item.email}
                    </p>
                  ) : null}

                  {item.preferredContactChannel ? (
                    <p>
                      <strong>
                        Contact préféré :
                      </strong>{" "}
                      {contactChannelLabel(
                        item.preferredContactChannel,
                      )}
                    </p>
                  ) : null}
                </div>

                <p>
                  Reçue le{" "}
                  {new Date(
                    item.createdAt,
                  ).toLocaleString(
                    "fr-FR",
                  )}
                </p>

                {item.message ? (
                  <p className="inquiry-message">
                    {item.message}
                  </p>
                ) : null}

                {item.status === "NEW" ? (
                  <Alert
                    tone="info"
                    title="Demande à prendre en compte"
                  >
                    Prenez en compte cette demande avant de commencer le suivi des échanges.
                  </Alert>
                ) : (
                  <PropertyInquiryCommunicationsPanel
                    propertyId={propertyId}
                    inquiryId={item.inquiryId}
                    api={api}
                    readOnly={
                      item.status === "CLOSED"
                    }
                  />
                )}

                {item.status ===
                "ACKNOWLEDGED" ? (
                  <PropertyViewingPanel
                    propertyId={
                      propertyId
                    }
                    inquiryId={
                      item.inquiryId
                    }
                    api={api}
                  />
                ) : null}
              </div>

              <div className="inquiry-card__actions">
                {item.status ===
                "NEW" ? (
                  <Button
                    onClick={() =>
                      void transition(
                        item,
                        "ack",
                      )
                    }
                  >
                    Prendre en compte
                  </Button>
                ) : null}

                {item.status !==
                "CLOSED" ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void transition(
                        item,
                        "close",
                      )
                    }
                  >
                    Clore
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <Button
          loading={loading}
          onClick={() =>
            void load(cursor)
          }
        >
          Afficher plus
        </Button>
      ) : null}
    </section>
  );
}

function statusLabel(
  status: PropertyInquiry["status"],
) {
  return status === "NEW"
    ? "Nouvelle"
    : status === "ACKNOWLEDGED"
      ? "Prise en compte"
      : "Clôturée";
}

function intentLabel(
  intent: PropertyInquiry["intent"],
) {
  return intent === "VIEWING_REQUEST"
    ? "Demande de visite"
    : "Intéressé par le bien";
}

function contactChannelLabel(
  channel: NonNullable<
    PropertyInquiry["preferredContactChannel"]
  >,
) {
  return channel === "PHONE"
    ? "Appel téléphonique"
    : channel === "SMS"
      ? "SMS"
      : "E-mail";
}