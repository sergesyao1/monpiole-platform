import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { PropertyApi } from "./property-api.js";
import { toPropertyUiError } from "./property-errors.js";
import { propertyTypeLabels, type Property, type PropertyComplexChild } from "./property-model.js";
import { Alert, Button, EmptyState, Field, LoadingState, buttonClassName } from "../../ui/index.js";

export function PropertyComplexChildrenSection({ property, api }: Readonly<{ property: Property; api: PropertyApi }>) {
  const [items, setItems] = useState<readonly PropertyComplexChild[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [childType, setChildType] = useState<Property["propertyType"]>("HOUSE");
  const [transactionType, setTransactionType] = useState<Property["transactionType"]>("LONG_TERM_RENTAL");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setItems([]);
    if (!api.listComplexChildren) {
      setError("La composition de cette résidence est indisponible.");
      setLoading(false);
      return () => { active = false; };
    }
    void api.listComplexChildren(property.propertyId).then((page) => {
      if (!active) return;
      setItems(page.items);
      setCursor(page.pageInfo.nextCursor);
      setError(undefined);
    }).catch((caught) => { if (active) setError(toPropertyUiError(caught, "composition").message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, property.propertyId]);

  async function loadMore() {
    if (!cursor || !api.listComplexChildren) return;
    setLoadingMore(true);
    setError(undefined);
    try {
      const page = await api.listComplexChildren(property.propertyId, cursor);
      setItems((current) => [...new Map([...current, ...page.items].map((item) => [item.property.propertyId, item])).values()]);
      setCursor(page.pageInfo.nextCursor);
    } catch (caught) {
      setError(`${toPropertyUiError(caught, "composition").message} Les biens déjà affichés restent disponibles.`);
    } finally {
      setLoadingMore(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api.createComplexChild) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const type = String(data.get("propertyType")) as Property["propertyType"];
    const transactionType = String(data.get("transactionType")) as Property["transactionType"];
    const description = String(data.get("description") ?? "").trim();
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const child = await api.createComplexChild(property.propertyId, {
        childCode: String(data.get("childCode")), title: String(data.get("title")),
        ...(description ? { description } : {}), propertyType: type, transactionType,
        ...(type === "APARTMENT" && transactionType === "LONG_TERM_RENTAL"
          ? { apartmentSubtype: String(data.get("apartmentSubtype")) as "STUDIO" | "MULTI_ROOM" } : {}),
        location: { country: String(data.get("country")), city: String(data.get("city")),
          district: String(data.get("district")), addressLine: String(data.get("addressLine")) },
      });
      setItems((current) => [...new Map([...current, child].map((item) => [item.property.propertyId, item])).values()]);
      setMessage("Bien ajouté à la résidence.");
      form.reset();
    } catch (caught) {
      setError(toPropertyUiError(caught, "composition").message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="complex-children">
    <h3>Villas et biens indépendants</h3>
    {message && <Alert tone="success" title={message} />}
    {error && <Alert tone="danger" title="Composition indisponible"><p>{error}</p></Alert>}
    <details className="composition-details"><summary>Ajouter un bien à la résidence</summary>
      <form className="composition-form" onSubmit={(event) => void create(event)}>
        <fieldset disabled={busy || !api.createComplexChild}><legend>Créer un bien dans la résidence</legend>
          <div className="composition-form-grid">
            <Field label="Code dans la résidence"><input name="childCode" required maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9._/ \-]{0,49}" /></Field>
            <Field label="Nom du bien"><input name="title" required maxLength={200} /></Field>
            <Field label="Type de bien"><select name="propertyType" value={childType} onChange={(event) => setChildType(event.currentTarget.value as Property["propertyType"])}><option value="HOUSE">Villa / Maison</option><option value="APARTMENT">Appartement</option><option value="OFFICE">Bureau</option><option value="SHOP">Boutique / Local commercial</option><option value="LAND">Terrain</option></select></Field>
            <Field label="Projet commercial"><select name="transactionType" value={transactionType} onChange={(event) => setTransactionType(event.currentTarget.value as Property["transactionType"])}><option value="LONG_TERM_RENTAL">Location longue durée</option><option value="SHORT_TERM_RENTAL">Location courte durée</option><option value="SALE">Vente</option></select></Field>
            {childType === "APARTMENT" && transactionType === "LONG_TERM_RENTAL" && <Field label="Sous-type d’appartement"><select name="apartmentSubtype"><option value="STUDIO">Studio</option><option value="MULTI_ROOM">Plusieurs pièces</option></select></Field>}
            <Field label="Pays"><input name="country" required minLength={2} maxLength={2} pattern="[A-Z]{2}" defaultValue={property.location.country} /></Field>
            <Field label="Ville"><input name="city" required maxLength={200} defaultValue={property.location.city} /></Field>
            <Field label="Quartier"><input name="district" required maxLength={200} defaultValue={property.location.district} /></Field>
            <Field label="Adresse"><input name="addressLine" required maxLength={200} defaultValue={property.location.addressLine} /></Field>
          </div>
          <Field label="Description" optional><textarea name="description" maxLength={5000} /></Field>
          <Button type="submit" loading={busy} loadingLabel="Création en cours…">Ajouter le bien</Button>
        </fieldset>
      </form>
    </details>
    {loading ? <LoadingState label="Chargement des biens de la résidence…" />
      : items.length === 0 ? <EmptyState title="Aucun bien direct" description="Les villas et appartements créés dans cette résidence apparaîtront ici." />
        : <ul className="composition-list">{items.map((item) => <li key={item.property.propertyId} className="composition-building">
          <strong>{item.childCode} — {item.property.title}</strong>
          <span>{propertyTypeLabels[item.property.propertyType]}</span>
          <Link className={buttonClassName("subtle")} to={`/properties/${item.property.propertyId}`}>Ouvrir la fiche</Link>
        </li>)}</ul>}
    {cursor && <Button variant="secondary" loading={loadingMore} loadingLabel="Chargement…" onClick={() => void loadMore()}>Afficher plus de biens</Button>}
  </div>;
}
