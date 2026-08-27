import { useState } from "react";
import type { FormEvent } from "react";

import { pricingUnitLabels, transactionTypeLabels, type Property, type UpdatePropertyDetailsInput } from "./property-model.js";

function optionalNumber(values: FormData, name: string): number | undefined {
  const value = String(values.get(name) ?? "").trim();
  return value === "" ? undefined : Number(value);
}

export function detailsInputFromForm(property: Property, values: FormData): UpdatePropertyDetailsInput {
  const details = {
    usableSurfaceSquareMeters: optionalNumber(values, "usableSurfaceSquareMeters"),
    rooms: optionalNumber(values, "rooms"),
    bedrooms: optionalNumber(values, "bedrooms"),
    bathrooms: optionalNumber(values, "bathrooms"),
    furnished: values.get("furnished") === "on",
  };
  const currency = String(values.get("currency") ?? "").trim().toUpperCase();
  if (property.transactionType === "LONG_TERM_RENTAL") {
    return { details, commercialTerms: {
      kind: "LONG_TERM_RENTAL", currency, rentPeriod: "MONTH",
      rentAmountMinor: Number(values.get("rentAmountMinor")),
      ...(optionalNumber(values, "securityDepositAmountMinor") === undefined ? {} : { securityDepositAmountMinor: optionalNumber(values, "securityDepositAmountMinor") }),
      ...(optionalNumber(values, "chargesAmountMinor") === undefined ? {} : { chargesAmountMinor: optionalNumber(values, "chargesAmountMinor") }),
    } };
  }
  if (property.transactionType === "SHORT_TERM_RENTAL") {
    return { details, commercialTerms: {
      kind: "SHORT_TERM_RENTAL", currency,
      rateAmountMinor: Number(values.get("rateAmountMinor")),
      pricingUnit: String(values.get("pricingUnit")) as "NIGHT" | "WEEK",
    } };
  }
  return { details, commercialTerms: { kind: "SALE", currency, salePriceAmountMinor: Number(values.get("salePriceAmountMinor")) } };
}

export function PropertyDetailsForm({ property, saving, onSave }: Readonly<{
  property: Property; saving: boolean; onSave: (input: UpdatePropertyDetailsInput) => Promise<void>;
}>) {
  const [clientError, setClientError] = useState("");
  const terms = property.commercialTerms;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const input = detailsInputFromForm(property, new FormData(form));
    if (input.details.rooms !== undefined && input.details.bedrooms !== undefined && input.details.bedrooms > input.details.rooms) {
      setClientError("Le nombre de chambres ne peut pas dépasser le nombre de pièces.");
      return;
    }
    setClientError(""); void onSave(input);
  }
  return (
    <form className="property-form" onSubmit={submit}>
      <fieldset disabled={saving}>
        <legend>Caractéristiques</legend>
        <div className="form-grid four-columns">
          <label>Surface utile (m²)<input name="usableSurfaceSquareMeters" type="number" min="0.01" step="0.01" defaultValue={property.details?.usableSurfaceSquareMeters} /></label>
          <label>Pièces<input name="rooms" type="number" min="0" step="1" defaultValue={property.details?.rooms} /></label>
          <label>Chambres<input name="bedrooms" type="number" min="0" step="1" defaultValue={property.details?.bedrooms} /></label>
          <label>Salles de bain<input name="bathrooms" type="number" min="0" step="1" defaultValue={property.details?.bathrooms} /></label>
          <label className="checkbox-field"><input name="furnished" type="checkbox" defaultChecked={property.details?.furnished ?? false} /> Bien meublé</label>
        </div>
      </fieldset>
      <fieldset disabled={saving}>
        <legend>Conditions — {transactionTypeLabels[property.transactionType]}</legend>
        <div className="form-grid three-columns">
          <label>Devise ISO<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" defaultValue={terms?.currency ?? "XOF"} /></label>
          {property.transactionType === "LONG_TERM_RENTAL" && <>
            <label>Loyer mensuel (unité mineure)<input name="rentAmountMinor" required type="number" min="0" step="1" defaultValue={terms?.kind === "LONG_TERM_RENTAL" ? terms.rentAmountMinor : undefined} /></label>
            <label>Dépôt de garantie (unité mineure)<input name="securityDepositAmountMinor" type="number" min="0" step="1" defaultValue={terms?.kind === "LONG_TERM_RENTAL" ? terms.securityDepositAmountMinor : undefined} /></label>
            <label>Charges (unité mineure)<input name="chargesAmountMinor" type="number" min="0" step="1" defaultValue={terms?.kind === "LONG_TERM_RENTAL" ? terms.chargesAmountMinor : undefined} /></label>
          </>}
          {property.transactionType === "SHORT_TERM_RENTAL" && <>
            <label>Tarif (unité mineure)<input name="rateAmountMinor" required type="number" min="0" step="1" defaultValue={terms?.kind === "SHORT_TERM_RENTAL" ? terms.rateAmountMinor : undefined} /></label>
            <label>Unité de tarification<select name="pricingUnit" defaultValue={terms?.kind === "SHORT_TERM_RENTAL" ? terms.pricingUnit : "NIGHT"}><option value="NIGHT">{pricingUnitLabels.NIGHT}</option><option value="WEEK">{pricingUnitLabels.WEEK}</option></select></label>
          </>}
          {property.transactionType === "SALE" && <label>Prix de vente (unité mineure)<input name="salePriceAmountMinor" required type="number" min="0" step="1" defaultValue={terms?.kind === "SALE" ? terms.salePriceAmountMinor : undefined} /></label>}
        </div>
      </fieldset>
      {clientError && <p className="field-error" role="alert">{clientError}</p>}
      <button className="primary-action" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer les détails"}</button>
    </form>
  );
}
