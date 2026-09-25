import { useState } from "react";
import type { FormEvent } from "react";

import type { Property, UpdatePropertyDetailsInput } from "./property-model.js";
import { Alert, Button } from "../../ui/index.js";

function optionalNumber(values: FormData, name: string): number | undefined {
  const value = String(values.get(name) ?? "").trim();
  return value === "" ? undefined : Number(value);
}

export function detailsInputFromForm(_property: Property, values: FormData): UpdatePropertyDetailsInput {
  const details = {
    usableSurfaceSquareMeters: optionalNumber(values, "usableSurfaceSquareMeters"),
    rooms: optionalNumber(values, "rooms"),
    bedrooms: optionalNumber(values, "bedrooms"),
    bathrooms: optionalNumber(values, "bathrooms"),
    furnished: values.get("furnished") === "on",
  };
  return { details };
}

export function PropertyDetailsForm({ property, saving, onSave }: Readonly<{
  property: Property; saving: boolean; onSave: (input: UpdatePropertyDetailsInput) => Promise<void>;
}>) {
  const [clientError, setClientError] = useState("");
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
        <legend>Caractéristiques du bien</legend>
        <div className="form-grid four-columns">
          <label>Surface utile (m²)<input name="usableSurfaceSquareMeters" type="number" min="0.01" step="0.01" defaultValue={property.details?.usableSurfaceSquareMeters} /></label>
          <label>Pièces<input name="rooms" type="number" min="0" step="1" defaultValue={property.details?.rooms} /></label>
          <label>Chambres<input name="bedrooms" type="number" min="0" step="1" defaultValue={property.details?.bedrooms} /></label>
          <label>Salles de bain<input name="bathrooms" type="number" min="0" step="1" defaultValue={property.details?.bathrooms} /></label>
          <label className="checkbox-field"><input name="furnished" type="checkbox" defaultChecked={property.details?.furnished ?? false} /> Bien meublé</label>
        </div>
      </fieldset>
      {clientError && <Alert tone="danger" title="Détails invalides"><p>{clientError}</p></Alert>}
      <Button type="submit" loading={saving} loadingLabel="Enregistrement…">Enregistrer les caractéristiques</Button>
    </form>
  );
}
