import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useSession } from "../../auth/session.js";
import { Alert, Button, EmptyState, LoadingState, PageHeader, StatusBadge, buttonClassName } from "../../ui/index.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import type { PropertyCommercialJourneyItem, PropertyCommercialNextAction, PropertyCommercialStage } from "./property-model.js";

const stageLabels: Record<PropertyCommercialStage, string> = {
  NEW_INQUIRY: "Nouvelle demande", ACKNOWLEDGED_INQUIRY: "Demande prise en compte",
  SCHEDULED_VIEWING: "Visite planifiée", COMPLETED_VIEWING: "Visite effectuée",
  FOLLOW_UP_REQUIRED: "À relancer", PROCEED: "Suite favorable", DECLINED: "Sans suite",
  SUBMITTED_APPLICATION: "Candidature soumise", APPROVED_APPLICATION: "Candidature approuvée",
  REJECTED_APPLICATION: "Candidature rejetée", WITHDRAWN_APPLICATION: "Candidature retirée",
  CLIENT_CREATED: "Client créé", DRAFT_CONTRACT: "Contrat en préparation", ACTIVE_CONTRACT: "Contrat actif",
  ENDED_CONTRACT: "Contrat terminé", CANCELLED_CONTRACT: "Contrat annulé", CLOSED_INQUIRY: "Demande close",
};
const actionLabels: Record<PropertyCommercialNextAction, string> = {
  ACKNOWLEDGE: "Prendre en compte", SCHEDULE_VIEWING: "Planifier une visite",
  COMPLETE_VIEWING: "Effectuer la visite", RECORD_OUTCOME: "Renseigner le résultat",
  DECIDE_OUTCOME: "Relancer ou décider", CREATE_APPLICATION: "Créer la candidature",
  DECIDE_APPLICATION: "Étudier la candidature", CREATE_CLIENT: "Créer le client",
  CREATE_CONTRACT: "Préparer le contrat", ACTIVATE_CONTRACT: "Finaliser ou activer",
};

export function PropertyCommercialJourneysPage() {
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const [items, setItems] = useState<readonly PropertyCommercialJourneyItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const [nextPageError, setNextPageError] = useState(false);

  async function load(next?: string) {
    next ? setLoadingMore(true) : setLoading(true);
    next ? setNextPageError(false) : setError(undefined);
    try {
      const page = await api.listPropertyCommercialJourneys(next);
      setItems(current => next
        ? [...new Map([...current, ...page.items].map(item => [item.inquiryId, item])).values()]
        : page.items);
      setCursor(page.pageInfo.nextCursor);
    } catch (cause: unknown) {
      if (next) setNextPageError(true); else setError(toPropertyUiError(cause, "commercial-journeys"));
    } finally {
      next ? setLoadingMore(false) : setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [api]);

  return <div className="page-stack">
    <PageHeader eyebrow="Suivi commercial" title="Demandes" description="Repérez les parcours qui nécessitent votre attention, puis poursuivez leur traitement dans l’espace du bien." />
    <section className="content-panel" aria-labelledby="commercial-journeys-title" aria-busy={loading || loadingMore}>
      <div className="section-heading"><div><p className="eyebrow">Tous les biens</p><h2 id="commercial-journeys-title">Parcours commerciaux</h2></div></div>
      {error && <PropertyFeedback error={error} onReconnect={() => void session.login("/demandes")} />}
      {nextPageError && <Alert tone="danger" title="Impossible de charger la suite"><p>Les demandes déjà affichées restent disponibles.</p></Alert>}
      {loading && items.length === 0 ? <LoadingState label="Chargement des demandes…" />
        : items.length === 0 && !error ? <EmptyState title="Aucune demande à traiter pour le moment." description="Les demandes reçues pour vos biens apparaîtront ici." />
          : <ul className="inquiry-list">{items.map(item => <JourneyItem key={item.inquiryId} item={item} />)}</ul>}
      {cursor && <Button variant="secondary" loading={loadingMore} loadingLabel="Chargement…" onClick={() => void load(cursor)}>Afficher plus de demandes</Button>}
    </section>
  </div>;
}

function JourneyItem({ item }: Readonly<{ item: PropertyCommercialJourneyItem }>) {
  return <li>
    <div><strong>{item.contactName}</strong><p>{item.propertyTitle}</p><p>{new Date(item.relevantAt).toLocaleString("fr-FR")}</p></div>
    <div><StatusBadge>{stageLabels[item.stage]}</StatusBadge><span>{item.nextAction ? actionLabels[item.nextAction] : "Aucune action attendue"}</span><Link className={buttonClassName("secondary", "inline-action")} to={`/properties/${item.propertyId}#${item.workspaceAnchor}`}>Ouvrir</Link></div>
  </li>;
}
