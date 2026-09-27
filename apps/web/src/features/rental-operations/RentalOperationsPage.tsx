import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useSession } from "../../auth/session.js";
import { Alert, Button, EmptyState, LoadingState, PageHeader, StatusBadge, buttonClassName } from "../../ui/index.js";
import { createRentalOperationsApi, type InspectionDraft, type RentalOperationItem } from "./rental-operations-api.js";

const statusLabels: Record<string, string> = { PREPARING: "Préparation", OCCUPIED: "Occupation en cours", ENDED: "Terminée", CANCELLED: "Annulée",
  CONFIRMED: "Réservation confirmée", IN_STAY: "Séjour en cours", COMPLETED: "Terminé", NO_SHOW: "Non-présentation" };
const assessmentLabels = { GOOD: "Bon état", FAIR: "État correct", POOR: "État dégradé", DAMAGED: "Endommagé", MISSING: "Manquant" } as const;

export function RentalOperationsPage() {
  const session = useSession(); const api = useMemo(() => createRentalOperationsApi(session), [session]);
  const [items, setItems] = useState<readonly RentalOperationItem[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>(); const [success, setSuccess] = useState<string>(); const [busy, setBusy] = useState<string>();
  async function load() { setLoading(true); setError(undefined); try { setItems((await api.list()).items); } catch { setError("Impossible de charger les opérations locatives."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [api]);
  async function act(key: string, message: string, operation: () => Promise<unknown>) { setBusy(key); setError(undefined); setSuccess(undefined); try { await operation(); setSuccess(message); await load(); } catch { setError("L’action n’a pas pu être réalisée. Vérifiez l’état de l’opération puis réessayez."); } finally { setBusy(undefined); } }
  const today = new Date().toISOString().slice(0, 10);
  const arrivals = items.filter(item => item.mode === "SHORT_TERM_RENTAL" && item.plannedArrivalAt?.slice(0, 10) === today);
  const departures = items.filter(item => item.mode === "SHORT_TERM_RENTAL" && item.plannedDepartureAt?.slice(0, 10) === today);
  return <div className="page-stack"><PageHeader eyebrow="Exploitation locative" title="Opérations locatives" description="Pilotez les arrivées, occupations, départs, états des lieux et remises en état." />
    <section className="content-panel"><div className="section-heading"><div><p className="eyebrow">Aujourd’hui</p><h2>À traiter</h2></div></div>
      <div className="metric-grid"><div><strong>{arrivals.length}</strong><span>Arrivées</span></div><div><strong>{departures.length}</strong><span>Départs</span></div><div><strong>{items.filter(item=>item.actualOccupancyStartedAt&&!item.actualOccupancyEndedAt).length}</strong><span>Occupations</span></div></div>
      {error && <Alert tone="danger" title="Une erreur est survenue"><p>{error}</p><Button variant="secondary" onClick={() => void load()}>Réessayer</Button></Alert>}
      {success && <Alert tone="success" title="Action enregistrée"><p>{success}</p></Alert>}
      {loading ? <LoadingState label="Chargement des opérations…" /> : items.length === 0 ? <EmptyState title="Aucune opération locative à traiter." description="Les locations et réservations opérationnelles apparaîtront ici." />
        : <ul className="inquiry-list">{items.map(item => <OperationCard key={item.leaseId ?? item.bookingId} item={item} busy={busy} act={act} api={api} />)}</ul>}
    </section></div>;
}

function OperationCard({ item, busy, act, api }: Readonly<{ item: RentalOperationItem; busy?: string; act: (key:string,message:string,operation:()=>Promise<unknown>)=>Promise<void>; api: ReturnType<typeof createRentalOperationsApi> }>) {
  const [draft, setDraft] = useState<InspectionDraft>({ area: "", item: "", assessment: "GOOD", damageObserved: false });
  const [cleaningAt, setCleaningAt] = useState(""); const capabilities=item.capabilities; const key=item.leaseId??item.bookingId!;
  function inspection(event:FormEvent,type:"ENTRY"|"EXIT"){event.preventDefault();void act(`${key}-${type}`,type==="ENTRY"?"État des lieux d’entrée enregistré.":"État des lieux de sortie enregistré.",()=>api.completeInspection(item,type,draft));}
  return <li><div><strong>{item.mode==="LONG_TERM_RENTAL"?"Location longue durée":"Location courte durée"}</strong><p>Bien : {item.rentableAssetId}</p>
    {item.plannedArrivalAt&&<p>Arrivée prévue : {format(item.plannedArrivalAt)}</p>}{item.plannedDepartureAt&&<p>Départ prévu : {format(item.plannedDepartureAt)}</p>}
    {item.actualOccupancyStartedAt&&<p>Début réel : {format(item.actualOccupancyStartedAt)}</p>}</div><div><StatusBadge>{statusLabels[item.leaseStatus??item.bookingStatus??""]??"À préparer"}</StatusBadge>
    <Link className={buttonClassName("secondary","inline-action")} to={`/properties/${item.rentableAssetId}`}>Ouvrir le bien</Link></div>
    {(capabilities?.canCompleteEntryInspection||capabilities?.canCompleteExitInspection)&&<form onSubmit={event=>inspection(event,capabilities.canCompleteEntryInspection?"ENTRY":"EXIT")}>
      <label>Pièce ou zone<input required value={draft.area} onChange={event=>setDraft(current=>({...current,area:event.target.value}))} /></label>
      <label>Équipement ou élément<input required value={draft.item} onChange={event=>setDraft(current=>({...current,item:event.target.value}))} /></label>
      <label>État<select value={draft.assessment} onChange={event=>setDraft(current=>({...current,assessment:event.target.value as InspectionDraft["assessment"]}))}>{Object.entries(assessmentLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label><input type="checkbox" checked={draft.damageObserved} onChange={event=>setDraft(current=>({...current,damageObserved:event.target.checked}))} /> Dommage constaté</label>
      <Button type="submit" loading={busy===`${key}-${capabilities.canCompleteEntryInspection?"ENTRY":"EXIT"}`}>{capabilities.canCompleteEntryInspection?"Valider l’état des lieux d’entrée":"Valider l’état des lieux de sortie"}</Button></form>}
    {capabilities?.canStartOccupancy&&<Button loading={busy===`${key}-start`} onClick={()=>void act(`${key}-start`,item.mode==="SHORT_TERM_RENTAL"?"Arrivée enregistrée.":"Occupation démarrée.",()=>api.start(item))}>{item.mode==="SHORT_TERM_RENTAL"?"Enregistrer l’arrivée":"Démarrer l’occupation"}</Button>}
    {capabilities?.canEndOccupancy&&item.mode==="LONG_TERM_RENTAL"&&<Button loading={busy===`${key}-end`} onClick={()=>void act(`${key}-end`,"Occupation terminée.",()=>api.endLongTerm(item))}>Terminer l’occupation</Button>}
    {capabilities?.canEndOccupancy&&item.mode==="SHORT_TERM_RENTAL"&&<form onSubmit={event=>{event.preventDefault();void act(`${key}-checkout`,"Départ enregistré et nettoyage planifié.",()=>api.checkout(item,new Date(cleaningAt).toISOString()));}}><label>Fin de nettoyage prévue<input type="datetime-local" required value={cleaningAt} onChange={event=>setCleaningAt(event.target.value)} /></label><Button type="submit" loading={busy===`${key}-checkout`}>Enregistrer le départ</Button></form>}
  </li>;
}
function format(value:string){return new Date(value).toLocaleString("fr-FR");}
