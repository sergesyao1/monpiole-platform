import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { PropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { propertyOwnerName, type PropertyOwner, type PropertyOwnership } from "./property-model.js";

interface OwnershipView { readonly ownership: PropertyOwnership; readonly owner?: PropertyOwner; }
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PropertyOwnershipSection({ propertyId, api }: Readonly<{ propertyId: string; api: PropertyApi }>) {
  const [items, setItems] = useState<readonly OwnershipView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const [clientError, setClientError] = useState("");

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

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const ownerId = String(values.get("ownerId") ?? "").trim();
    const ownershipShare = Number(values.get("ownershipShare"));
    if (!UUID_PATTERN.test(ownerId)) { setClientError("Saisissez un identifiant de propriétaire valide."); return; }
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
        <p className="form-help">L’API ne fournit pas encore de liste des propriétaires. Utilisez l’identifiant d’un propriétaire déjà créé.</p>
        <div className="form-grid two-columns">
          <label>Identifiant du propriétaire<input name="ownerId" required placeholder="00000000-0000-4000-8000-000000000000" /></label>
          <label>Quote-part (%)<input name="ownershipShare" required type="number" min="0.01" max="100" step="0.01" /></label>
        </div>
        {clientError && <p className="field-error" role="alert">{clientError}</p>}
        <button className="secondary-action" type="submit" disabled={saving}>{saving ? "Affectation…" : "Affecter le propriétaire"}</button>
      </form>
    </section>
  );
}
