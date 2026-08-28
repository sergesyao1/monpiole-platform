import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { PropertyOwnerForm } from "./PropertyOwnerForm.js";
import { propertyOwnerName, type PropertyOwner, type PropertyOwnerInput } from "./property-model.js";

export function PropertyOwnerDetailPage() {
  const { ownerId = "" } = useParams(); const location = useLocation(); const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const [owner, setOwner] = useState<PropertyOwner>(); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean((location.state as { created?: boolean } | null)?.created)); const [error, setError] = useState<PropertyUiError>();
  useEffect(() => { let active = true; setLoading(true); setError(undefined); void api.retrievePropertyOwner(ownerId).then((value) => { if (active) setOwner(value); }).catch((caught: unknown) => { if (active) setError(toPropertyUiError(caught)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [api, ownerId]);
  async function save(input: PropertyOwnerInput) { setSaving(true); setSaved(false); setError(undefined); try { setOwner(await api.updatePropertyOwner(ownerId, input)); setSaved(true); } catch (caught) { setError(toPropertyUiError(caught)); } finally { setSaving(false); } }
  if (loading) return <div className="standalone-state"><div className="loading-indicator" aria-hidden="true" /><p role="status">Chargement du propriétaire…</p></div>;
  if (!owner) return <div className="standalone-state"><h1>Propriétaire introuvable</h1><PropertyFeedback error={error ?? toPropertyUiError(undefined)} onReconnect={() => void session.login(`/proprietaires/${ownerId}`)} /><Link className="secondary-action inline-action" to="/proprietaires">Retour à l’annuaire</Link></div>;
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">Fiche propriétaire</p><h1>{propertyOwnerName(owner)}</h1><p className="resource-id">{owner.ownerId}</p></div><Link className="secondary-action inline-action" to="/proprietaires">Retour à l’annuaire</Link></div>{saved && <div className="form-message is-success" role="status"><strong>Enregistré</strong><p>Les informations du propriétaire sont à jour.</p></div>}{error && <PropertyFeedback error={error} />}<section className="content-panel"><PropertyOwnerForm owner={owner} saving={saving} onSubmit={save} /></section></div>;
}
