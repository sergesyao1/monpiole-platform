import type { FormEvent } from "react";
import type { Property, UpdatePropertyCoreInformationInput } from "./property-model.js";
import { Button, Field } from "../../ui/index.js";

export function coreInformationInputFromForm(values: FormData): UpdatePropertyCoreInformationInput {
  const description = String(values.get("description") ?? "").trim();
  return {
    title: String(values.get("title") ?? "").trim(),
    ...(description === "" ? {} : { description }),
    ...(values.get("apartmentSubtype") === null ? {} : {
      apartmentSubtype: String(values.get("apartmentSubtype")) as "STUDIO" | "MULTI_ROOM",
    }),
    location: {
      country: String(values.get("country") ?? "").trim().toUpperCase(),
      city: String(values.get("city") ?? "").trim(),
      district: String(values.get("district") ?? "").trim(),
      addressLine: String(values.get("addressLine") ?? "").trim(),
    },
  };
}

export function PropertyCoreInformationForm({ property, saving, onSave }: Readonly<{
  property: Property;
  saving: boolean;
  onSave: (input: UpdatePropertyCoreInformationInput) => Promise<void>;
}>) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    void onSave(coreInformationInputFromForm(new FormData(form)));
  }

  return (
    <form className="property-form" onSubmit={submit}>
      <fieldset disabled={saving}>
        <legend>Identification et localisation</legend>
        <div className="form-grid two-columns">
          <Field label="Titre"><input name="title" required maxLength={200} defaultValue={property.title} /></Field>
          {property.propertyType === "APARTMENT" && property.transactionType === "LONG_TERM_RENTAL" && (
            <Field label="Sous-type d’appartement"><select name="apartmentSubtype" required defaultValue={property.apartmentSubtype ?? "STUDIO"}>
              <option value="STUDIO">Studio</option><option value="MULTI_ROOM">Plusieurs pièces</option>
            </select></Field>
          )}
          <Field label="Pays (code ISO à 2 lettres)"><input name="country" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" defaultValue={property.location.country} /></Field>
          <Field label="Ville"><input name="city" required maxLength={200} defaultValue={property.location.city} /></Field>
          <Field label="Quartier"><input name="district" required maxLength={200} defaultValue={property.location.district} /></Field>
          <div className="full-width"><Field label="Adresse"><input name="addressLine" required maxLength={200} defaultValue={property.location.addressLine} /></Field></div>
          <div className="full-width"><Field label="Description" optional><textarea name="description" maxLength={5000} rows={5} defaultValue={property.description} /></Field></div>
        </div>
      </fieldset>
      <Button type="submit" loading={saving} loadingLabel="Enregistrement…">Enregistrer les informations</Button>
    </form>
  );
}
