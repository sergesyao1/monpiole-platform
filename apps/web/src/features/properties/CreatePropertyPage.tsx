import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { propertyTypeLabels, propertyTypes, transactionTypeLabels, transactionTypes, type CreatePropertyInput } from "./property-model.js";

export function CreatePropertyPage() {
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<PropertyUiError>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const description = String(values.get("description") ?? "").trim();
    const input: CreatePropertyInput = {
      title: String(values.get("title") ?? "").trim(),
      ...(description ? { description } : {}),
      propertyType: String(values.get("propertyType")) as CreatePropertyInput["propertyType"],
      transactionType: String(values.get("transactionType")) as CreatePropertyInput["transactionType"],
      location: {
        country: String(values.get("country") ?? "").trim().toUpperCase(),
        city: String(values.get("city") ?? "").trim(),
        district: String(values.get("district") ?? "").trim(),
        addressLine: String(values.get("addressLine") ?? "").trim(),
      },
    };
    setSubmitting(true); setError(undefined);
    try {
      const created = await api.createProperty(input);
      navigate(`/properties/${created.propertyId}`, { state: { created: true } });
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack property-page">
      <div className="page-heading">
        <div><p className="eyebrow">Nouveau bien</p><h1>Créer un bien immobilier</h1></div>
        <Link className="secondary-action inline-action" to="/properties">Retour aux biens</Link>
      </div>
      {error && <PropertyFeedback error={error} onReconnect={() => void session.login("/properties/new")} />}
      <form className="property-form content-panel" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={submitting}>
          <legend>Informations générales</legend>
          <div className="form-grid two-columns">
            <label>Titre du bien<input name="title" required maxLength={200} placeholder="Appartement lumineux à Cocody" /></label>
            <label>Type de bien<select name="propertyType" defaultValue="APARTMENT">{propertyTypes.map((value) => <option key={value} value={value}>{propertyTypeLabels[value]}</option>)}</select></label>
            <label>Projet commercial<select name="transactionType" defaultValue="LONG_TERM_RENTAL">{transactionTypes.map((value) => <option key={value} value={value}>{transactionTypeLabels[value]}</option>)}</select></label>
            <label className="full-width">Description<textarea name="description" maxLength={5000} rows={4} placeholder="Décrivez les atouts essentiels du bien." /></label>
          </div>
        </fieldset>
        <fieldset disabled={submitting}>
          <legend>Adresse</legend>
          <div className="form-grid two-columns">
            <label>Pays (code ISO)<input name="country" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" defaultValue="CI" /></label>
            <label>Ville<input name="city" required maxLength={200} placeholder="Abidjan" /></label>
            <label>Quartier<input name="district" required maxLength={200} placeholder="Cocody" /></label>
            <label>Adresse<input name="addressLine" required maxLength={200} placeholder="Rue, résidence ou repère" /></label>
          </div>
        </fieldset>
        <div className="form-actions">
          <button className="primary-action" type="submit" disabled={submitting}>{submitting ? "Création en cours…" : "Créer le bien"}</button>
        </div>
      </form>
    </div>
  );
}
