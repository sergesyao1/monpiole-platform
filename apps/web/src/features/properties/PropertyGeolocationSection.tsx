import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import type { PropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  propertyGeolocationPublicVisibilityLabels,
  type PropertyGeolocation,
  type PropertyGeolocationPublicVisibility,
} from "./property-model.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { Alert, Button, Field, LoadingState, buttonClassName } from "../../ui/index.js";

interface PropertyGeolocationSectionProps {
  readonly propertyId: string;
  readonly api: Pick<PropertyApi, "retrievePropertyGeolocation" | "updatePropertyGeolocation" | "removePropertyGeolocation">;
  readonly onReconnect: () => void;
}

export function PropertyGeolocationSection({ propertyId, api, onReconnect }: PropertyGeolocationSectionProps) {
  const [geolocation, setGeolocation] = useState<PropertyGeolocation>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<string>();
  const [error, setError] = useState<PropertyUiError>();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    void api.retrievePropertyGeolocation(propertyId)
      .then((value) => {
        if (!active) return;
        setGeolocation(validResponse(value) ? value : { configured: false, source: "OWN" });
      })
      .catch((caught: unknown) => { if (active) setError(toPropertyUiError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, propertyId, reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = geolocationInputFromForm(new FormData(event.currentTarget));
    if (typeof input === "string") {
      setValidation(input);
      return;
    }
    if (input.publicVisibility === "EXACT"
      && !window.confirm("La position exacte pourra être utilisée publiquement lors d’une future activation. Confirmer ce choix ?")) return;
    setSaving(true); setSaved(false); setValidation(undefined); setError(undefined);
    try {
      setGeolocation(await api.updatePropertyGeolocation(propertyId, input));
      setSaved(true);
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Supprimer la géolocalisation de ce bien ?")) return;
    setRemoving(true); setSaved(false); setValidation(undefined); setError(undefined);
    try {
      await api.removePropertyGeolocation(propertyId);
      setGeolocation({ configured: false, source: "OWN" });
      setSaved(true);
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="content-panel" aria-labelledby="property-geolocation-title">
      <div className="section-heading">
        <div><p className="eyebrow">Position structurée</p><h2 id="property-geolocation-title">Géolocalisation et confidentialité</h2></div>
      </div>
      {loading && <LoadingState label="Chargement de la géolocalisation…" />}
      {!loading && error && <><PropertyFeedback error={error} onReconnect={onReconnect} /><Button variant="secondary" onClick={() => setReload((value) => value + 1)}>Réessayer</Button></>}
      {!loading && !error && geolocation?.source === "INHERITED" && (
        <div className="form-stack">
          <p>Cette unité hérite de la géolocalisation de son ensemble immobilier. La position ne peut pas être modifiée ici.</p>
          {geolocation.configured
            ? <dl className="definition-grid"><div><dt>Latitude</dt><dd>{formatCoordinate(geolocation.latitude)}</dd></div><div><dt>Longitude</dt><dd>{formatCoordinate(geolocation.longitude)}</dd></div><div><dt>Visibilité</dt><dd>{propertyGeolocationPublicVisibilityLabels[geolocation.publicVisibility]}</dd></div></dl>
            : <p role="status">Aucune géolocalisation n’est configurée sur l’ensemble immobilier parent.</p>}
          <Link className={buttonClassName("secondary", "inline-action")} to={`/properties/${geolocation.inheritedFromPropertyId}`}>Ouvrir l’ensemble immobilier parent</Link>
        </div>
      )}
      {!loading && !error && geolocation?.source === "OWN" && (
        <form className="form-stack" onSubmit={(event) => void save(event)} key={formKey(geolocation)} noValidate>
          {!geolocation.configured && <p role="status">Aucune géolocalisation n’est enregistrée pour ce bien.</p>}
          <div className="form-grid">
            <Field label="Latitude"><input name="latitude" required inputMode="decimal" placeholder="5.336000" defaultValue={geolocation.configured ? formatCoordinate(geolocation.latitude) : ""} /></Field>
            <Field label="Longitude"><input name="longitude" required inputMode="decimal" placeholder="-4.027000" defaultValue={geolocation.configured ? formatCoordinate(geolocation.longitude) : ""} /></Field>
            <Field label="Visibilité de la position" help="La position approximative utilise une grille stable d’environ un kilomètre."><select name="publicVisibility" defaultValue={geolocation.configured ? geolocation.publicVisibility : "HIDDEN"}>
              <option value="EXACT">Position exacte</option>
              <option value="APPROXIMATE">Position approximative</option>
              <option value="HIDDEN">Masquer la position</option>
            </select></Field>
          </div>
          <p className="field-help">Aucune carte ni service externe n’est appelé.</p>
          {validation && <Alert tone="danger" title="Coordonnées invalides"><p>{validation}</p></Alert>}
          {saved && <Alert tone="success" title="Géolocalisation à jour"><p>La décision de confidentialité a été enregistrée.</p></Alert>}
          <div className="form-actions">
            <Button type="submit" disabled={removing} loading={saving} loadingLabel="Enregistrement…">Enregistrer la géolocalisation</Button>
            {geolocation.configured && <Button variant="danger" disabled={saving} loading={removing} loadingLabel="Suppression…" onClick={() => void remove()}>Supprimer la géolocalisation</Button>}
          </div>
        </form>
      )}
    </section>
  );
}

export function geolocationInputFromForm(form: FormData): Readonly<{
  latitude: number;
  longitude: number;
  publicVisibility: PropertyGeolocationPublicVisibility;
}> | string {
  const latitude = parseCoordinate(form.get("latitude"));
  const longitude = parseCoordinate(form.get("longitude"));
  const visibility = String(form.get("publicVisibility") ?? "");
  if (latitude === undefined || latitude < -90 || latitude > 90) return "La latitude doit être un nombre compris entre -90 et 90, avec au maximum six décimales.";
  if (longitude === undefined || longitude < -180 || longitude > 180) return "La longitude doit être un nombre compris entre -180 et 180, avec au maximum six décimales.";
  if (visibility !== "EXACT" && visibility !== "APPROXIMATE" && visibility !== "HIDDEN") return "Choisissez une visibilité valide.";
  return { latitude, longitude, publicVisibility: visibility };
}

function parseCoordinate(value: FormDataEntryValue | null): number | undefined {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d{1,6})?$/u.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function formKey(geolocation: Extract<PropertyGeolocation, { source: "OWN" }>): string {
  return geolocation.configured
    ? `${geolocation.latitude}:${geolocation.longitude}:${geolocation.publicVisibility}`
    : "empty";
}

function validResponse(value: PropertyGeolocation): boolean {
  return typeof value.configured === "boolean" && (value.source === "OWN" || value.source === "INHERITED");
}
