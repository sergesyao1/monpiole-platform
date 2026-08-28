import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { PropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { propertyOwnerName, type PropertyOwner, type PropertyOwnership } from "./property-model.js";

interface OwnershipView { readonly ownership: PropertyOwnership; readonly owner?: PropertyOwner; }

export function PropertyOwnershipSection({ propertyId, api }: Readonly<{ propertyId: string; api: PropertyApi }>) {
  const [items, setItems] = useState<readonly OwnershipView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const [clientError, setClientError] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<readonly PropertyOwner[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [appliedOwnerSearch, setAppliedOwnerSearch] = useState<string>();
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownersError, setOwnersError] = useState<PropertyUiError>();
  const [ownersReload, setOwnersReload] = useState(0);

  async function load() {
    setLoading(true); setError(undefined);
    try {
      const ownerships = await api.retrieveOwnerships(propertyId);
      const owners = await Promise.all(ownerships.map(async (ownership) => ({
        ownership, owner: await api.retrievePropertyOwner(ownership.ownerId),
      })));
      setItems(owners);
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [propertyId]);

  useEffect(() => {
    let active = true;
    setOwnersLoading(true); setOwnersError(undefined);
    void api.listPropertyOwners({ limit: 100, ...(appliedOwnerSearch === undefined ? {} : { search: appliedOwnerSearch }) })
      .then((page) => { if (active) setOwnerOptions(page.items); })
      .catch((caught: unknown) => { if (active) { setOwnerOptions([]); setOwnersError(toPropertyUiError(caught)); } })
      .finally(() => { if (active) setOwnersLoading(false); });
    return () => { active = false; };
  }, [api, appliedOwnerSearch, ownersReload]);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const ownerId = String(values.get("ownerId") ?? "").trim();
    const ownershipShare = Number(values.get("ownershipShare"));
    if (ownerId === "") { setClientError("Sélectionnez un propriétaire disponible."); return; }
    if (!Number.isFinite(ownershipShare) || ownershipShare <= 0 || ownershipShare > 100 || Math.round(ownershipShare * 100) !== ownershipShare * 100) {
      setClientError("La quote-part doit être comprise entre 0,01 et 100 avec deux décimales au maximum."); return;
    }
    setSaving(true); setClientError(""); setError(undefined);
    try { await api.assignPropertyOwner(propertyId, ownerId, ownershipShare); form.reset(); await load(); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  async function remove(ownerId: string) {
    if (saving) return;
    setSaving(true); setError(undefined);
    try { await api.removePropertyOwner(propertyId, ownerId); await load(); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  return (
    <section className="content-panel" aria-labelledby="property-owners-title">
      <div className="section-heading"><div><p className="eyebrow">Propriété</p><h2 id="property-owners-title">Propriétaires affectés</h2></div></div>
      {error && <PropertyFeedback error={error} />}
      {loading ? <p className="muted-status" role="status">Chargement des propriétaires…</p> : items.length === 0 ? (
        <p className="muted-status">Aucun propriétaire n’est encore affecté à ce bien.</p>
      ) : (
        <ul className="ownership-list">
          {items.map(({ ownership, owner }) => <li key={ownership.ownerId}>
            <div><strong>{owner ? propertyOwnerName(owner) : "Propriétaire non consultable"}</strong><small>{ownership.ownerId}</small></div>
            <span>{ownership.ownershipShare.toLocaleString("fr-FR")} %</span>
            <button className="danger-action" type="button" disabled={saving} onClick={() => void remove(ownership.ownerId)}>Retirer</button>
          </li>)}
        </ul>
      )}
      <form className="compact-form ownership-form" onSubmit={(event) => void assign(event)}>
        <h3>Affecter un propriétaire existant</h3>
        <p className="form-help">Recherchez puis sélectionnez un propriétaire de votre annuaire.</p>
        <div className="owner-picker-search" role="search">
          <label>Rechercher dans l’annuaire<input value={ownerSearch} maxLength={100} onChange={(event) => setOwnerSearch(event.target.value)} placeholder="Nom, raison sociale ou e-mail" /></label>
          <button className="secondary-action" type="button" disabled={ownersLoading} onClick={() => setAppliedOwnerSearch(ownerSearch.trim() || undefined)}>Rechercher</button>
        </div>
        {ownersError && <div className="form-message" role="alert"><strong>Annuaire indisponible</strong><p>{ownersError.message}</p><button className="secondary-action" type="button" onClick={() => setOwnersReload((current) => current + 1)}>Réessayer</button></div>}
        {!ownersLoading && !ownersError && ownerOptions.length === 0 && <p className="muted-status" role="status">{appliedOwnerSearch ? "Aucun propriétaire ne correspond à cette recherche." : "Aucun propriétaire n’est disponible. Créez-en un depuis l’annuaire."}</p>}
        <div className="form-grid two-columns">
          <label>Propriétaire<select name="ownerId" required defaultValue="" disabled={ownersLoading || ownerOptions.length === 0}><option value="">Sélectionner un propriétaire</option>{ownerOptions.map((owner) => { const assigned = items.some(({ ownership }) => ownership.ownerId === owner.ownerId); return <option key={owner.ownerId} value={owner.ownerId} disabled={assigned}>{propertyOwnerName(owner)}{assigned ? " — déjà affecté" : ""}</option>; })}</select></label>
          <label>Quote-part (%)<input name="ownershipShare" required type="number" min="0.01" max="100" step="0.01" /></label>
        </div>
        {clientError && <p className="field-error" role="alert">{clientError}</p>}
        <button className="secondary-action" type="submit" disabled={saving}>{saving ? "Affectation…" : "Affecter le propriétaire"}</button>
      </form>
    </section>
  );
}
