import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { PropertyOwnerForm } from "./PropertyOwnerForm.js";
import type { PropertyOwnerInput } from "./property-model.js";
import { PageHeader, buttonClassName } from "../../ui/index.js";

export function CreatePropertyOwnerPage() {
  const session = useSession(); const navigate = useNavigate();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<PropertyUiError>();
  async function save(input: PropertyOwnerInput) {
    setSaving(true); setError(undefined);
    try { const owner = await api.createPropertyOwner(input); navigate(`/proprietaires/${owner.ownerId}`, { state: { created: true } }); }
    catch (caught) { setError(toPropertyUiError(caught)); setSaving(false); }
  }
  return <div className="page-stack"><PageHeader actions={<Link className={buttonClassName("secondary", "inline-action")} to="/proprietaires">Retour à l’annuaire</Link>} breadcrumbs={[{ label: "Propriétaires", to: "/proprietaires" }, { label: "Nouveau" }]} eyebrow="Nouveau propriétaire" title="Créer un propriétaire" />{error && <PropertyFeedback error={error} onReconnect={() => void session.login("/proprietaires/new")} />}<section className="content-panel"><PropertyOwnerForm saving={saving} onSubmit={save} /></section></div>;
}
