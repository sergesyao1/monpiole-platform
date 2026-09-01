import { useState } from "react";
import type { FormEvent } from "react";

import {
  currencyFractionDigits, majorAmountInputToMinor, minorAmountToInputValue,
  pricingUnitLabels, transactionTypeLabels, type Property, type UpdatePropertyDetailsInput,
} from "./property-model.js";
import { Alert, Button } from "../../ui/index.js";

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
      rentAmountMinor: majorAmountInputToMinor(values.get("rentAmountMinor"), currency),
      ...(optionalAmountMinor(values, "securityDepositAmountMinor", currency) === undefined ? {} : { securityDepositAmountMinor: optionalAmountMinor(values, "securityDepositAmountMinor", currency) }),
      ...(optionalAmountMinor(values, "chargesAmountMinor", currency) === undefined ? {} : { chargesAmountMinor: optionalAmountMinor(values, "chargesAmountMinor", currency) }),
    } };
  }
  if (property.transactionType === "SHORT_TERM_RENTAL") {
    return { details, commercialTerms: {
      kind: "SHORT_TERM_RENTAL", currency,
      rateAmountMinor: majorAmountInputToMinor(values.get("rateAmountMinor"), currency),
      pricingUnit: String(values.get("pricingUnit")) as "NIGHT" | "WEEK",
    } };
  }
  return { details, commercialTerms: { kind: "SALE", currency, salePriceAmountMinor: majorAmountInputToMinor(values.get("salePriceAmountMinor"), currency) } };
}

function optionalAmountMinor(values: FormData, name: string, currency: string): number | undefined {
  const value = String(values.get(name) ?? "").trim();
  return value === "" ? undefined : majorAmountInputToMinor(value, currency);
}

export function PropertyDetailsForm({ property, saving, onSave }: Readonly<{
  property: Property; saving: boolean; onSave: (input: UpdatePropertyDetailsInput) => Promise<void>;
}>) {
  const [clientError, setClientError] = useState("");
  const terms = property.commercialTerms;
  const [currency, setCurrency] = useState(terms?.currency ?? "XOF");
  const amountStep = currencyFractionDigits(currency) === 0 ? "1" : `0.${"0".repeat(currencyFractionDigits(currency) - 1)}1`;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const input = detailsInputFromForm(property, new FormData(form));
    const amounts = Object.entries(input.commercialTerms).filter(([name]) => name.endsWith("AmountMinor")).map(([, value]) => value);
    if (amounts.some((value) => typeof value === "number" && !Number.isSafeInteger(value))) {
      setClientError(`Saisissez un montant valide pour la devise ${input.commercialTerms.currency}.`);
      return;
    }
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
          <label>Devise ISO<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={currency}
            onChange={(event) => setCurrency(event.currentTarget.value.toUpperCase())} /></label>
          {property.transactionType === "LONG_TERM_RENTAL" && <>
            <label>Loyer mensuel<input name="rentAmountMinor" required type="number" min="0" step={amountStep} defaultValue={terms?.kind === "LONG_TERM_RENTAL" ? minorAmountToInputValue(terms.rentAmountMinor, terms.currency) : undefined} /></label>
            <label>Dépôt de garantie<input name="securityDepositAmountMinor" type="number" min="0" step={amountStep} defaultValue={terms?.kind === "LONG_TERM_RENTAL" && terms.securityDepositAmountMinor !== undefined ? minorAmountToInputValue(terms.securityDepositAmountMinor, terms.currency) : undefined} /></label>
            <label>Charges<input name="chargesAmountMinor" type="number" min="0" step={amountStep} defaultValue={terms?.kind === "LONG_TERM_RENTAL" && terms.chargesAmountMinor !== undefined ? minorAmountToInputValue(terms.chargesAmountMinor, terms.currency) : undefined} /></label>
          </>}
          {property.transactionType === "SHORT_TERM_RENTAL" && <>
            <label>Tarif<input name="rateAmountMinor" required type="number" min="0" step={amountStep} defaultValue={terms?.kind === "SHORT_TERM_RENTAL" ? minorAmountToInputValue(terms.rateAmountMinor, terms.currency) : undefined} /></label>
            <label>Unité de tarification<select name="pricingUnit" defaultValue={terms?.kind === "SHORT_TERM_RENTAL" ? terms.pricingUnit : "NIGHT"}><option value="NIGHT">{pricingUnitLabels.NIGHT}</option><option value="WEEK">{pricingUnitLabels.WEEK}</option></select></label>
          </>}
          {property.transactionType === "SALE" && <label>Prix de vente<input name="salePriceAmountMinor" required type="number" min="0" step={amountStep} defaultValue={terms?.kind === "SALE" ? minorAmountToInputValue(terms.salePriceAmountMinor, terms.currency) : undefined} /></label>}
        </div>
      </fieldset>
      {clientError && <Alert tone="danger" title="Détails invalides"><p>{clientError}</p></Alert>}
      <Button type="submit" loading={saving} loadingLabel="Enregistrement…">Enregistrer les détails</Button>
    </form>
  );
}
