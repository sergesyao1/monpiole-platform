import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { useSession } from "../../auth/session.js";
import { Alert, Button, EmptyState, LoadingState, PageHeader, StatusBadge, buttonClassName } from "../../ui/index.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import type { PropertyCommercialJourneyCriteria, PropertyCommercialJourneyItem, PropertyCommercialJourneySort, PropertyCommercialNextAction, PropertyCommercialStage } from "./property-model.js";

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
const sortLabels: Record<PropertyCommercialJourneySort, string> = { RECENT: "Plus récent d’abord", OLDEST: "Plus ancien d’abord" };

interface DraftFilters { q: string; propertyId: string; stage: string; nextAction: string; sort: string }

export function PropertyCommercialJourneysPage() {
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const [searchParams, setSearchParams] = useSearchParams();
  const criteria = useMemo(() => criteriaFrom(searchParams), [searchParams]);
  const [draft, setDraft] = useState<DraftFilters>(() => draftFrom(criteria));
  const [items, setItems] = useState<readonly PropertyCommercialJourneyItem[]>([]);
  const [properties, setProperties] = useState<readonly { propertyId: string; title: string }[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const [nextPageError, setNextPageError] = useState(false);
  const filtered = Boolean(criteria.q || criteria.propertyId || criteria.stage || criteria.nextAction || criteria.sort !== "RECENT");

  async function load(next?: string) {
    next ? setLoadingMore(true) : setLoading(true);
    next ? setNextPageError(false) : setError(undefined);
    try {
      const page = await api.listPropertyCommercialJourneys(criteria, next);
      setItems(current => next ? [...new Map([...current, ...page.items].map(item => [item.inquiryId, item])).values()] : page.items);
      setProperties(page.properties); setTotalCount(page.totalCount); setCursor(page.pageInfo.nextCursor);
    } catch (cause: unknown) {
      if (next) setNextPageError(true); else setError(toPropertyUiError(cause, "commercial-journeys"));
    } finally { next ? setLoadingMore(false) : setLoading(false); }
  }

  useEffect(() => { setDraft(draftFrom(criteria)); void load(); }, [api, searchParams.toString()]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draft.q.trim()) next.set("q", draft.q.trim());
    if (draft.propertyId) next.set("propertyId", draft.propertyId);
    if (isStage(draft.stage)) next.set("stage", draft.stage);
    if (isAction(draft.nextAction)) next.set("nextAction", draft.nextAction);
    if (draft.sort === "OLDEST") next.set("sort", draft.sort);
    setSearchParams(next);
  }
  function reset() { setDraft(draftFrom(DEFAULT_CRITERIA)); setSearchParams(new URLSearchParams()); }
  function field(name: keyof DraftFilters, value: string) { setDraft(current => ({ ...current, [name]: value })); }

  return <div className="page-stack">
    <PageHeader eyebrow="Suivi commercial" title="Demandes" description="Repérez les parcours qui nécessitent votre attention, puis poursuivez leur traitement dans l’espace du bien." />
    <section className="content-panel" aria-labelledby="commercial-journeys-title" aria-busy={loading || loadingMore}>
      <div className="section-heading"><div><p className="eyebrow">Tous les biens</p><h2 id="commercial-journeys-title">Parcours commerciaux</h2></div></div>
      <form className="commercial-journey-filters" onSubmit={apply}>
        <label className="commercial-search">Recherche<input value={draft.q} onChange={event => field("q", event.target.value)} placeholder="Rechercher un nom, téléphone, email, bien..." /></label>
        <label>Bien<select value={draft.propertyId} onChange={event => field("propertyId", event.target.value)}><option value="">Tous les biens</option>{properties.map(property => <option key={property.propertyId} value={property.propertyId}>{property.title}</option>)}</select></label>
        <label>Statut<select value={draft.stage} onChange={event => field("stage", event.target.value)}><option value="">Tous les statuts</option>{entries(stageLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Étape suivante<select value={draft.nextAction} onChange={event => field("nextAction", event.target.value)}><option value="">Toutes</option>{entries(actionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Trier par<select value={draft.sort} onChange={event => field("sort", event.target.value)}>{entries(sortLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <div className="commercial-filter-actions"><Button type="submit">Filtrer</Button><Button type="button" variant="secondary" onClick={reset}>Réinitialiser les filtres</Button></div>
      </form>
      <p className="commercial-result-count" aria-live="polite">{totalCount} {totalCount === 1 ? "résultat" : "résultats"}</p>
      {error && <PropertyFeedback error={error} onReconnect={() => void session.login("/demandes")} />}
      {nextPageError && <Alert tone="danger" title="Impossible de charger la suite"><p>Les demandes déjà affichées restent disponibles.</p></Alert>}
      {loading && items.length === 0 ? <LoadingState label="Chargement des demandes…" />
        : items.length === 0 && !error && filtered ? <FilteredEmpty onReset={reset} />
          : items.length === 0 && !error ? <EmptyState title="Aucune demande à traiter pour le moment." description="Les demandes reçues pour vos biens apparaîtront ici." />
            : <ul className="inquiry-list">{items.map(item => <JourneyItem key={item.inquiryId} item={item} />)}</ul>}
      {cursor && <Button variant="secondary" loading={loadingMore} loadingLabel="Chargement…" onClick={() => void load(cursor)}>Afficher plus de demandes</Button>}
    </section>
  </div>;
}

const DEFAULT_CRITERIA: PropertyCommercialJourneyCriteria = { sort: "RECENT" };
function criteriaFrom(params: URLSearchParams): PropertyCommercialJourneyCriteria {
  const q=params.get("q")?.trim(),propertyId=params.get("propertyId"),stage=params.get("stage"),nextAction=params.get("nextAction"),sort=params.get("sort");
  return {...(q?{q}:{}),...(propertyId?{propertyId}:{}),...(stage&&isStage(stage)?{stage}:{}),...(nextAction&&isAction(nextAction)?{nextAction}:{}),sort:sort==="OLDEST"?"OLDEST":"RECENT"};
}
function draftFrom(criteria: PropertyCommercialJourneyCriteria): DraftFilters { return { q:criteria.q??"",propertyId:criteria.propertyId??"",stage:criteria.stage??"",nextAction:criteria.nextAction??"",sort:criteria.sort }; }
function isStage(value:string):value is PropertyCommercialStage{return Object.hasOwn(stageLabels,value);}
function isAction(value:string):value is PropertyCommercialNextAction{return Object.hasOwn(actionLabels,value);}
function entries<T extends string>(record:Record<T,string>){return Object.entries(record) as [T,string][];}
function FilteredEmpty({onReset}:Readonly<{onReset:()=>void}>){return <div className="empty-state"><h3>Aucun résultat ne correspond à vos critères.</h3><Button variant="secondary" onClick={onReset}>Réinitialiser les filtres</Button></div>;}
function JourneyItem({ item }: Readonly<{ item: PropertyCommercialJourneyItem }>) { return <li><div><strong>{item.contactName}</strong><p>{item.propertyTitle}</p><p>{new Date(item.relevantAt).toLocaleString("fr-FR")}</p></div><div><StatusBadge>{stageLabels[item.stage]}</StatusBadge><span>{item.nextAction ? actionLabels[item.nextAction] : "Aucune action attendue"}</span><Link className={buttonClassName("secondary", "inline-action")} to={`/properties/${item.propertyId}#${item.workspaceAnchor}`}>Ouvrir</Link></div></li>; }
