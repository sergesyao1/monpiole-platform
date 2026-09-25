import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { PropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import type {
  PropertyAvailability,
  PropertyAvailabilityStatus,
  PropertyOccupancyStatus,
  TransactionType,
} from "./property-model.js";
import { Alert, Button, Field, LoadingState, StatusBadge } from "../../ui/index.js";

const availabilityLabels: Readonly<Record<PropertyAvailabilityStatus | "NOT_CONFIGURED", string>> = {
  AVAILABLE: "Disponible",
  UNAVAILABLE: "Indisponible",
  NOT_CONFIGURED: "Non renseignée",
};
const occupancyLabels: Readonly<Record<PropertyOccupancyStatus, string>> = {
  VACANT: "Libre",
  OCCUPIED: "Occupé",
};

interface PropertyAvailabilitySectionProps {
  readonly propertyId: string;
  readonly transactionType: TransactionType;
  readonly api: Pick<PropertyApi, "retrievePropertyAvailability" | "updatePropertyAvailability">;
  readonly compact?: boolean;
  readonly label?: string;
  readonly onReconnect?: () => void;
  readonly initialAvailability?: PropertyAvailability;
}

export function PropertyAvailabilitySection({
  propertyId,
  transactionType,
  api,
  compact = false,
  label,
  onReconnect,
  initialAvailability,
}: Readonly<PropertyAvailabilitySectionProps>) {
  const [availability, setAvailability] = useState<PropertyAvailability | undefined>(initialAvailability);
  const [availabilityStatus, setAvailabilityStatus] = useState<PropertyAvailabilityStatus>("AVAILABLE");
  const [occupancyStatus, setOccupancyStatus] = useState<PropertyOccupancyStatus>("VACANT");
  const [loading, setLoading] = useState(initialAvailability === undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<PropertyUiError>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const value = await api.retrievePropertyAvailability(propertyId);
      setAvailability(value);
      if (value.source === "DIRECT" && value.configured) {
        setAvailabilityStatus(value.availabilityStatus);
        setOccupancyStatus(value.occupancyStatus);
      }
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally {
      setLoading(false);
    }
  }, [api, propertyId]);

  useEffect(() => {
    if (initialAvailability !== undefined) {
      setAvailability(initialAvailability);
      setLoading(false);
      if (initialAvailability.source === "DIRECT" && initialAvailability.configured) {
        setAvailabilityStatus(initialAvailability.availabilityStatus);
        setOccupancyStatus(initialAvailability.occupancyStatus);
      }
      return;
    }
    void load();
  }, [initialAvailability, load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      const value = await api.updatePropertyAvailability(propertyId, { availabilityStatus, occupancyStatus });
      setAvailability(value);
      setSaved(true);
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <>
      {loading && <LoadingState label="Chargement de la disponibilité et de l’occupation…" />}
      {!loading && error && (
        <Alert tone="danger" title="Disponibilité indisponible">
          <p>{error.message}</p>
          {error.kind === "session" && onReconnect
            ? <Button variant="secondary" onClick={onReconnect}>Se reconnecter</Button>
            : <Button variant="secondary" onClick={() => void load()}>Réessayer</Button>}
        </Alert>
      )}
      {!loading && availability?.source === "DERIVED_FROM_UNITS" && <CompositeSummary availability={availability} />}
      {!loading && availability?.source === "DIRECT" && (
        <>
          <dl className="definition-grid">
            <div><dt>Disponibilité</dt><dd><StatusBadge tone={availability.configured && availability.availabilityStatus === "AVAILABLE" ? "success" : availability.configured ? "warning" : "neutral"}>{availability.configured ? availabilityLabels[availability.availabilityStatus] : "Non renseignée"}</StatusBadge></dd></div>
            <div><dt>Occupation</dt><dd><StatusBadge tone={availability.configured && availability.occupancyStatus === "VACANT" ? "info" : availability.configured ? "warning" : "neutral"}>{availability.configured ? occupancyLabels[availability.occupancyStatus] : "Non renseignée"}</StatusBadge></dd></div>
            {availability.configured && <div><dt>État mis à jour</dt><dd>{formatInstant(availability.updatedAt)}</dd></div>}
          </dl>
          {availability.canUpdateAvailability && (
            <form className="availability-form" onSubmit={save}>
              <fieldset disabled={saving}>
                <legend>Mettre à jour la situation du bien</legend>
                <Field label="Disponibilité"><select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value as PropertyAvailabilityStatus)}>
                    <option value="AVAILABLE">Disponible</option>
                    <option value="UNAVAILABLE">Indisponible</option>
                  </select></Field>
                <Field label="Occupation"><select value={occupancyStatus} onChange={(event) => setOccupancyStatus(event.target.value as PropertyOccupancyStatus)}>
                    <option value="VACANT">Libre</option>
                    <option value="OCCUPIED">Occupé</option>
                  </select></Field>
                <Button type="submit" variant={compact ? "secondary" : "primary"} loading={saving} loadingLabel="Enregistrement…">Enregistrer la disponibilité</Button>
              </fieldset>
            </form>
          )}
          {saved && <Alert tone="success" title="Disponibilité et occupation à jour." />}
        </>
      )}
      {!loading && availability !== undefined && transactionType === "SHORT_TERM_RENTAL" && (
        <p>« Disponible » signifie que le bien accepte globalement des demandes. Cela ne garantit aucune date précise.</p>
      )}
    </>
  );

  if (compact) {
    return <section className="availability-compact" aria-label={label ?? "Disponibilité de l’unité"} aria-busy={loading || saving}><h4>Disponibilité et occupation</h4>{content}</section>;
  }
  return (
    <section className="content-panel" aria-labelledby={`property-availability-${propertyId}`} aria-busy={loading || saving}>
      <div className="section-heading"><div><p className="eyebrow">Situation commerciale</p><h2 id={`property-availability-${propertyId}`}>Disponibilité et occupation</h2></div></div>
      {content}
    </section>
  );
}

function CompositeSummary({ availability }: Readonly<{ availability: Extract<PropertyAvailability, { source: "DERIVED_FROM_UNITS" }> }>) {
  return (
    <>
      <p>La disponibilité de cet ensemble immobilier est calculée unité par unité. Elle ne peut pas être modifiée directement ici.</p>
      <dl className="definition-grid">
        <div><dt>Disponibilité de l’ensemble</dt><dd><StatusBadge tone={availability.availabilityStatus === "AVAILABLE" ? "success" : "warning"}>{availabilityLabels[availability.availabilityStatus]}</StatusBadge></dd></div>
        <div><dt>Unités au total</dt><dd>{availability.totalUnitCount}</dd></div>
        <div><dt>Unités renseignées</dt><dd>{availability.configuredUnitCount}</dd></div>
        <div><dt>Disponibles</dt><dd>{availability.availableUnitCount}</dd></div>
        <div><dt>Indisponibles</dt><dd>{availability.unavailableUnitCount}</dd></div>
        <div><dt>Libres</dt><dd>{availability.vacantUnitCount}</dd></div>
        <div><dt>Occupées</dt><dd>{availability.occupiedUnitCount}</dd></div>
        <div><dt>Non renseignées</dt><dd>{availability.unconfiguredUnitCount}</dd></div>
      </dl>
    </>
  );
}

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
