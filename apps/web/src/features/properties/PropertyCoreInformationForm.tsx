import type { FormEvent } from "react";
import type { Property, UpdatePropertyCoreInformationInput } from "./property-model.js";

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
          <label>Titre<input name="title" required maxLength={200} defaultValue={property.title} /></label>
          {property.propertyType === "APARTMENT" && property.transactionType === "LONG_TERM_RENTAL" && (
            <label>Sous-type d’appartement<select name="apartmentSubtype" required defaultValue={property.apartmentSubtype ?? "STUDIO"}>
              <option value="STUDIO">Studio</option><option value="MULTI_ROOM">Plusieurs pièces</option>
            </select></label>
          )}
          <label>Pays (code ISO à 2 lettres)<input name="country" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" defaultValue={property.location.country} /></label>
          <label>Ville<input name="city" required maxLength={200} defaultValue={property.location.city} /></label>
          <label>Quartier<input name="district" required maxLength={200} defaultValue={property.location.district} /></label>
          <label className="full-width">Adresse<input name="addressLine" required maxLength={200} defaultValue={property.location.addressLine} /></label>
          <label className="full-width">Description<textarea name="description" maxLength={5000} rows={5} defaultValue={property.description} /></label>
        </div>
      </fieldset>
      <button className="primary-action" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer les informations"}</button>
    </form>
  );
}
