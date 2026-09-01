import { useState } from "react";
import type { FormEvent } from "react";

import type { PropertyOwner, PropertyOwnerInput } from "./property-model.js";
import { Alert, Button, Field } from "../../ui/index.js";

export function PropertyOwnerForm({ owner, saving, onSubmit }: Readonly<{
  owner?: PropertyOwner;
  saving: boolean;
  onSubmit(input: PropertyOwnerInput): Promise<void>;
}>) {
  const [ownerType, setOwnerType] = useState<"INDIVIDUAL" | "LEGAL_ENTITY">(owner?.ownerType ?? "INDIVIDUAL");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const values = new FormData(event.currentTarget);
    const phoneNumber = String(values.get("phoneNumber") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const contact = { ...(phoneNumber === "" ? {} : { phoneNumber }), ...(email === "" ? {} : { email }) };
    let input: PropertyOwnerInput;
    if (ownerType === "INDIVIDUAL") {
      const firstName = String(values.get("firstName") ?? "").trim();
      const lastName = String(values.get("lastName") ?? "").trim();
      if (firstName === "" || lastName === "") { setError("Le prénom et le nom sont obligatoires."); return; }
      input = { ownerType, firstName, lastName, ...contact };
    } else {
      const legalName = String(values.get("legalName") ?? "").trim();
      const registrationNumber = String(values.get("registrationNumber") ?? "").trim();
      if (legalName === "") { setError("La raison sociale est obligatoire."); return; }
      input = { ownerType, legalName, ...(registrationNumber === "" ? {} : { registrationNumber }), ...contact };
    }
    setError("");
    void onSubmit(input);
  }

  return (
    <form className="property-form" onSubmit={submit}>
      <fieldset>
        <legend>Identité du propriétaire</legend>
        <div className="form-grid two-columns">
          <Field label="Type de propriétaire"><select value={ownerType} disabled={owner !== undefined || saving} onChange={(event) => setOwnerType(event.target.value as typeof ownerType)}>
              <option value="INDIVIDUAL">Personne physique</option>
              <option value="LEGAL_ENTITY">Personne morale</option>
            </select></Field>
          {ownerType === "INDIVIDUAL" ? <>
            <Field label="Prénom"><input name="firstName" required maxLength={200} defaultValue={owner?.ownerType === "INDIVIDUAL" ? owner.firstName : ""} /></Field>
            <Field label="Nom"><input name="lastName" required maxLength={200} defaultValue={owner?.ownerType === "INDIVIDUAL" ? owner.lastName : ""} /></Field>
          </> : <>
            <Field label="Raison sociale"><input name="legalName" required maxLength={300} defaultValue={owner?.ownerType === "LEGAL_ENTITY" ? owner.legalName : ""} /></Field>
            <Field label="Numéro d’immatriculation" optional><input name="registrationNumber" maxLength={200} defaultValue={owner?.ownerType === "LEGAL_ENTITY" ? owner.registrationNumber ?? "" : ""} /></Field>
          </>}
        </div>
      </fieldset>
      <fieldset>
        <legend>Coordonnées</legend>
        <div className="form-grid two-columns">
          <Field label="Téléphone" optional><input name="phoneNumber" maxLength={100} defaultValue={owner?.phoneNumber ?? ""} /></Field>
          <Field label="E-mail" optional><input name="email" type="email" maxLength={320} defaultValue={owner?.email ?? ""} /></Field>
        </div>
      </fieldset>
      {error && <Alert tone="danger" title="Informations incomplètes"><p>{error}</p></Alert>}
      <div className="form-actions"><Button type="submit" loading={saving} loadingLabel="Enregistrement…">Enregistrer</Button></div>
    </form>
  );
}
