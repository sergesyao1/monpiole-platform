import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { PropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { propertyOwnerName, type PropertyOwner, type PropertyOwnership, type PropertyWorkspaceOwnerSummary } from "./property-model.js";
import { Alert, Button, Field, LoadingState } from "../../ui/index.js";

interface OwnershipView { readonly ownership: PropertyOwnership; readonly displayName: string; }

export function PropertyOwnershipSection({ propertyId, api, initialOwners, canManage = true, onChanged }: Readonly<{
  propertyId: string;
  api: PropertyApi;
  initialOwners?: readonly PropertyWorkspaceOwnerSummary[];
  canManage?: boolean;
  onChanged?: () => void | Promise<void>;
}>) {
  const [items, setItems] = useState<readonly OwnershipView[]>(() => toViews(initialOwners));
  const [loading, setLoading] = useState(initialOwners === undefined);
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
        ownership, displayName: propertyOwnerName(await api.retrievePropertyOwner(ownership.ownerId)),
      })));
      setItems(owners);
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (initialOwners !== undefined) {
      setItems(toViews(initialOwners));
      setLoading(false);
      return;
    }
    void load();
  }, [propertyId, initialOwners]);

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
    try {
      await api.assignPropertyOwner(propertyId, ownerId, ownershipShare); form.reset();
      if (onChanged === undefined) await load(); else await onChanged();
    }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  async function remove(ownerId: string) {
    if (saving) return;
    if (!window.confirm("Retirer ce propriétaire du bien ?")) return;
    setSaving(true); setError(undefined);
    try {
      await api.removePropertyOwner(propertyId, ownerId);
      if (onChanged === undefined) await load(); else await onChanged();
    }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  return (
    <section className="content-panel" aria-labelledby="property-owners-title">
      <div className="section-heading"><div><p className="eyebrow">Propriété</p><h2 id="property-owners-title">Propriétaires affectés</h2></div></div>
      {error && <PropertyFeedback error={error} />}
      {loading ? <LoadingState label="Chargement des propriétaires…" /> : items.length === 0 ? (
        <p className="muted-status">Aucun propriétaire n’est encore affecté à ce bien.</p>
      ) : (
        <ul className="ownership-list">
          {items.map(({ ownership, displayName }) => <li key={ownership.ownerId}>
            <div><strong>{displayName}</strong><small>{ownership.ownerId}</small></div>
            <span>{ownership.ownershipShare.toLocaleString("fr-FR")} %</span>
            <Button variant="danger" disabled={saving} onClick={() => void remove(ownership.ownerId)}>Retirer</Button>
          </li>)}
        </ul>
      )}
      {canManage && <form className="compact-form ownership-form" onSubmit={(event) => void assign(event)}>
        <h3>Affecter un propriétaire existant</h3>
        <p className="form-help">Recherchez puis sélectionnez un propriétaire de votre annuaire.</p>
        <div className="owner-picker-search" role="search">
          <Field label="Rechercher dans l’annuaire" optional><input value={ownerSearch} maxLength={100} onChange={(event) => setOwnerSearch(event.target.value)} placeholder="Nom, raison sociale ou e-mail" /></Field>
          <Button variant="secondary" disabled={ownersLoading} onClick={() => setAppliedOwnerSearch(ownerSearch.trim() || undefined)}>Rechercher</Button>
        </div>
        {ownersError && <Alert tone="danger" title="Annuaire indisponible"><p>{ownersError.message}</p><Button variant="secondary" onClick={() => setOwnersReload((current) => current + 1)}>Réessayer</Button></Alert>}
        {!ownersLoading && !ownersError && ownerOptions.length === 0 && <p className="muted-status" role="status">{appliedOwnerSearch ? "Aucun propriétaire ne correspond à cette recherche." : "Aucun propriétaire n’est disponible. Créez-en un depuis l’annuaire."}</p>}
        <div className="form-grid two-columns">
          <Field label="Propriétaire"><select name="ownerId" required defaultValue="" disabled={ownersLoading || ownerOptions.length === 0}><option value="">Sélectionner un propriétaire</option>{ownerOptions.map((owner) => { const assigned = items.some(({ ownership }) => ownership.ownerId === owner.ownerId); return <option key={owner.ownerId} value={owner.ownerId} disabled={assigned}>{propertyOwnerName(owner)}{assigned ? " — déjà affecté" : ""}</option>; })}</select></Field>
          <Field label="Quote-part (%)"><input name="ownershipShare" required type="number" min="0.01" max="100" step="0.01" /></Field>
        </div>
        {clientError && <p className="field-error" role="alert">{clientError}</p>}
        <Button variant="secondary" type="submit" loading={saving} loadingLabel="Affectation…">Affecter le propriétaire</Button>
      </form>}
    </section>
  );
}

function toViews(owners: readonly PropertyWorkspaceOwnerSummary[] | undefined): readonly OwnershipView[] {
  return owners?.map((owner) => ({
    displayName: owner.displayName,
    ownership: {
      propertyId: "",
      ownerId: owner.ownerId,
      ownershipShare: owner.ownershipShare,
      createdAt: "",
    },
  })) ?? [];
}
