import { useState } from "react";
import type { FormEvent } from "react";

import {
  majorAmountInputToMinor,
  minorAmountToInputValue,
  pricingUnitLabels,
  transactionTypeLabels,
  type CommercialTerms,
  type Property,
  type PropertyPricingInput,
} from "./property-model.js";
import { Alert, Button } from "../../ui/index.js";

const CURRENCY = "XOF";

export function pricingInputFromForm(property: Property, values: FormData): PropertyPricingInput {
  if (property.transactionType === "LONG_TERM_RENTAL") {
    return {
      kind: "LONG_TERM_RENTAL",
      currency: CURRENCY,
      rentPeriod: "MONTH",
      rentAmountMinor: majorAmountInputToMinor(values.get("rentAmountMinor"), CURRENCY),
      ...optionalAmount(values, "securityDepositAmountMinor"),
      ...optionalAmount(values, "chargesAmountMinor"),
      ...optionalAmount(values, "agencyFeeAmountMinor"),
    };
  }
  if (property.transactionType === "SHORT_TERM_RENTAL") {
    return {
      kind: "SHORT_TERM_RENTAL",
      currency: CURRENCY,
      rateAmountMinor: majorAmountInputToMinor(values.get("rateAmountMinor"), CURRENCY),
      pricingUnit: String(values.get("pricingUnit")) as "NIGHT" | "WEEK",
      ...optionalAmount(values, "cleaningFeeAmountMinor"),
      ...optionalAmount(values, "securityDepositAmountMinor"),
      ...optionalInteger(values, "minimumStayNights"),
    };
  }
  return {
    kind: "SALE",
    currency: CURRENCY,
    salePriceAmountMinor: majorAmountInputToMinor(values.get("salePriceAmountMinor"), CURRENCY),
    ...optionalAmount(values, "agencyFeeAmountMinor"),
  };
}

export function PropertyPricingForm({ property, saving, onSave }: Readonly<{
  property: Property;
  saving: boolean;
  onSave: (input: PropertyPricingInput) => Promise<void>;
}>) {
  const [clientError, setClientError] = useState("");
  const terms = strictDefaults(property.commercialTerms);
  const legacyPricing = property.commercialTerms !== undefined && terms === undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const input = pricingInputFromForm(property, new FormData(form));
    const amounts = Object.entries(input)
      .filter(([name]) => name.endsWith("AmountMinor"))
      .map(([, value]) => value);
    if (amounts.some((value) => typeof value === "number" && (!Number.isSafeInteger(value) || value < 0))
      || primaryAmount(input) < 1) {
      setClientError("Saisissez des montants valides en FCFA. Le prix principal doit être supérieur à zéro.");
      return;
    }
    if (input.kind === "SHORT_TERM_RENTAL" && input.minimumStayNights !== undefined
      && (!Number.isSafeInteger(input.minimumStayNights)
        || input.minimumStayNights < 1 || input.minimumStayNights > 2_147_483_647)) {
      setClientError("La durée minimale doit être un nombre entier de nuits supérieur à zéro.");
      return;
    }
    setClientError("");
    void onSave(input);
  }

  return (
    <form className="property-form" onSubmit={submit}>
      <fieldset disabled={saving}>
        <legend>Tarification — {transactionTypeLabels[property.transactionType]}</legend>
        <p>Les nouvelles tarifications sont enregistrées exclusivement en FCFA (XOF).</p>
        {legacyPricing ? <Alert tone="warning" title="Tarification historique">
          <p>La tarification actuelle reste lisible. Enregistrer ce formulaire la remplacera par une tarification XOF conforme aux règles actuelles.</p>
        </Alert> : null}
        <div className="form-grid three-columns">
          <label>Devise<input value={CURRENCY} readOnly aria-readonly="true" /></label>
          {property.transactionType === "LONG_TERM_RENTAL" ? <>
            <MoneyField name="rentAmountMinor" label="Loyer mensuel" required value={terms?.kind === "LONG_TERM_RENTAL" ? terms.rentAmountMinor : undefined} />
            <MoneyField name="securityDepositAmountMinor" label="Dépôt de garantie" value={terms?.kind === "LONG_TERM_RENTAL" ? terms.securityDepositAmountMinor : undefined} />
            <MoneyField name="chargesAmountMinor" label="Charges" value={terms?.kind === "LONG_TERM_RENTAL" ? terms.chargesAmountMinor : undefined} />
            <MoneyField name="agencyFeeAmountMinor" label="Frais d’agence" value={terms?.kind === "LONG_TERM_RENTAL" ? terms.agencyFeeAmountMinor : undefined} />
          </> : null}
          {property.transactionType === "SHORT_TERM_RENTAL" ? <>
            <MoneyField name="rateAmountMinor" label="Tarif" required value={terms?.kind === "SHORT_TERM_RENTAL" ? terms.rateAmountMinor : undefined} />
            <label>Unité de tarification<select name="pricingUnit" defaultValue={terms?.kind === "SHORT_TERM_RENTAL" ? terms.pricingUnit : "NIGHT"}>
              <option value="NIGHT">{pricingUnitLabels.NIGHT}</option><option value="WEEK">{pricingUnitLabels.WEEK}</option>
            </select></label>
            <MoneyField name="cleaningFeeAmountMinor" label="Frais de ménage" value={terms?.kind === "SHORT_TERM_RENTAL" ? terms.cleaningFeeAmountMinor : undefined} />
            <MoneyField name="securityDepositAmountMinor" label="Dépôt de garantie" value={terms?.kind === "SHORT_TERM_RENTAL" ? terms.securityDepositAmountMinor : undefined} />
            <label>Durée minimale (nuits)<input name="minimumStayNights" type="number" min="1" max="2147483647" step="1" defaultValue={terms?.kind === "SHORT_TERM_RENTAL" ? terms.minimumStayNights : undefined} /></label>
          </> : null}
          {property.transactionType === "SALE" ? <>
            <MoneyField name="salePriceAmountMinor" label="Prix de vente" required value={terms?.kind === "SALE" ? terms.salePriceAmountMinor : undefined} />
            <MoneyField name="agencyFeeAmountMinor" label="Frais d’agence" value={terms?.kind === "SALE" ? terms.agencyFeeAmountMinor : undefined} />
          </> : null}
        </div>
      </fieldset>
      {clientError ? <Alert tone="danger" title="Tarification invalide"><p>{clientError}</p></Alert> : null}
      <Button type="submit" loading={saving} loadingLabel="Enregistrement…">Enregistrer la tarification</Button>
    </form>
  );
}

function MoneyField({ name, label, value, required = false }: Readonly<{
  name: string;
  label: string;
  value?: number;
  required?: boolean;
}>) {
  return <label>{label} (FCFA)<input name={name} type="number" min={required ? "1" : "0"} step="1" required={required}
    defaultValue={value === undefined ? undefined : minorAmountToInputValue(value, CURRENCY)} /></label>;
}

function optionalAmount(values: FormData, name: string): Partial<Record<string, number>> {
  const raw = String(values.get(name) ?? "").trim();
  return raw === "" ? {} : { [name]: majorAmountInputToMinor(raw, CURRENCY) };
}

function optionalInteger(values: FormData, name: string): Partial<Record<string, number>> {
  const raw = String(values.get(name) ?? "").trim();
  return raw === "" ? {} : { [name]: Number(raw) };
}

function primaryAmount(pricing: PropertyPricingInput): number {
  if (pricing.kind === "LONG_TERM_RENTAL") return pricing.rentAmountMinor;
  if (pricing.kind === "SHORT_TERM_RENTAL") return pricing.rateAmountMinor;
  return pricing.salePriceAmountMinor;
}

function strictDefaults(terms: CommercialTerms | undefined): CommercialTerms | undefined {
  if (terms === undefined || terms.currency !== CURRENCY || primaryAmount(terms as PropertyPricingInput) < 1) return undefined;
  return terms;
}
