import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { propertyTypeLabels, propertyTypes, transactionTypeLabels, transactionTypes, type CreatePropertyInput } from "./property-model.js";
import { Button, Field, PageHeader, buttonClassName } from "../../ui/index.js";

export function CreatePropertyPage() {
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const [propertyType, setPropertyType] = useState<CreatePropertyInput["propertyType"]>("APARTMENT");
  const [transactionType, setTransactionType] = useState<CreatePropertyInput["transactionType"]>("LONG_TERM_RENTAL");
  const [commercializationMode, setCommercializationMode] = useState<"WHOLE_BUILDING" | "INDIVIDUAL_UNITS">("INDIVIDUAL_UNITS");

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
      propertyType,
      ...(propertyType === "BUILDING" ? { commercializationMode } : {}),
      transactionType,
      ...(propertyType === "APARTMENT" && transactionType === "LONG_TERM_RENTAL"
        ? { apartmentSubtype: String(values.get("apartmentSubtype")) as "STUDIO" | "MULTI_ROOM" }
        : {}),
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
      <PageHeader actions={<Link className={buttonClassName("secondary", "inline-action")} to="/properties">Retour aux biens</Link>} breadcrumbs={[{ label: "Biens", to: "/properties" }, { label: "Nouveau" }]} eyebrow="Nouveau bien" title="Créer un bien immobilier" />
      {error && <PropertyFeedback error={error} onReconnect={() => void session.login("/properties/new")} />}
      <form className="property-form content-panel" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={submitting}>
          <legend>Informations générales</legend>
          <div className="form-grid two-columns">
            <Field label="Titre du bien"><input name="title" required maxLength={200} placeholder="Appartement lumineux à Cocody" /></Field>
            <Field label="Type de bien"><select name="propertyType" value={propertyType} onChange={(event) => setPropertyType(event.currentTarget.value as CreatePropertyInput["propertyType"])}>{propertyTypes.map((value) => <option key={value} value={value}>{propertyTypeLabels[value]}</option>)}</select></Field>
            {propertyType === "BUILDING" && <Field label="Mode de commercialisation"><select name="commercializationMode" value={commercializationMode} onChange={(event) => setCommercializationMode(event.currentTarget.value as "WHOLE_BUILDING" | "INDIVIDUAL_UNITS")}><option value="INDIVIDUAL_UNITS">Unités commercialisées séparément</option><option value="WHOLE_BUILDING">Immeuble commercialisé en entier</option></select></Field>}
            <Field label="Projet commercial"><select name="transactionType" value={transactionType} onChange={(event) => setTransactionType(event.currentTarget.value as CreatePropertyInput["transactionType"])}>{transactionTypes.map((value) => <option key={value} value={value}>{transactionTypeLabels[value]}</option>)}</select></Field>
            {propertyType === "APARTMENT" && transactionType === "LONG_TERM_RENTAL" && (
              <Field label="Sous-type d’appartement"><select name="apartmentSubtype" defaultValue="STUDIO" required>
                <option value="STUDIO">Studio</option><option value="MULTI_ROOM">Plusieurs pièces</option>
              </select></Field>
            )}
            <div className="full-width"><Field label="Description" optional><textarea name="description" maxLength={5000} rows={4} placeholder="Décrivez les atouts essentiels du bien." /></Field></div>
          </div>
        </fieldset>
        <fieldset disabled={submitting}>
          <legend>Adresse</legend>
          <div className="form-grid two-columns">
            <Field label="Pays (code ISO)"><input name="country" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" defaultValue="CI" /></Field>
            <Field label="Ville"><input name="city" required maxLength={200} placeholder="Abidjan" /></Field>
            <Field label="Quartier"><input name="district" required maxLength={200} placeholder="Cocody" /></Field>
            <Field label="Adresse"><input name="addressLine" required maxLength={200} placeholder="Rue, résidence ou repère" /></Field>
          </div>
        </fieldset>
        <div className="form-actions">
          <Button type="submit" loading={submitting} loadingLabel="Création en cours…">Créer le bien</Button>
        </div>
      </form>
    </div>
  );
}
