import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import type { PropertyApi } from "./property-api.js";
import { PropertyAvailabilitySection } from "./PropertyAvailabilitySection.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  propertyTypeLabels,
  transactionTypeLabels,
  type Property,
  type PropertyBuilding,
  type PropertyStructuralRole,
  type PropertyUnit,
} from "./property-model.js";

const CODE_PATTERN = "[A-Za-z0-9][A-Za-z0-9._/ \\-]{0,49}";

interface UnitState {
  readonly items: readonly PropertyUnit[];
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
  readonly loading: boolean;
  readonly loaded: boolean;
  readonly error?: PropertyUiError;
}

function emptyUnits(): UnitState {
  return { items: [], nextCursor: null, hasNextPage: false, loading: false, loaded: false };
}

interface PropertyCompositionSectionProps {
  readonly property: Property;
  readonly api: PropertyApi;
  readonly onStructuralRoleChange?: (role: PropertyStructuralRole) => void;
}

export function PropertyCompositionSection({ property, api, onStructuralRoleChange }: Readonly<PropertyCompositionSectionProps>) {
  const [buildings, setBuildings] = useState<readonly PropertyBuilding[]>([]);
  const [buildingCursor, setBuildingCursor] = useState<string | null>(null);
  const [hasMoreBuildings, setHasMoreBuildings] = useState(false);
  const [units, setUnits] = useState<Record<string, UnitState>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyKey, setBusyKey] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<PropertyUiError>();
  const [pageError, setPageError] = useState<string>();

  useEffect(() => {
    let active = true;
    setBuildings([]);
    setUnits({});
    if (property.structuralRole === "UNIT") {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(undefined);
    void api.listBuildings(property.propertyId).then((page) => {
      if (!active) return;
      setBuildings(sortBuildings(Array.isArray(page.items) ? page.items : []));
      setBuildingCursor(page.pageInfo?.nextCursor ?? null);
      setHasMoreBuildings(page.pageInfo?.hasNextPage ?? false);
    }).catch((caught) => {
      if (active) setError(toPropertyUiError(caught, "composition"));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [api, property.propertyId]);

  function clearFeedback() {
    setMessage(undefined);
    setError(undefined);
  }

  async function retryInitialBuildings() {
    setLoading(true);
    clearFeedback();
    try {
      const page = await api.listBuildings(property.propertyId);
      setBuildings(sortBuildings(page.items));
      setBuildingCursor(page.pageInfo.nextCursor);
      setHasMoreBuildings(page.pageInfo.hasNextPage);
    } catch (caught) {
      setError(toPropertyUiError(caught, "composition"));
    } finally {
      setLoading(false);
    }
  }

  async function addBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyKey("create-building");
    clearFeedback();
    try {
      const building = await api.createBuilding(property.propertyId, {
        buildingCode: String(data.get("buildingCode")),
        name: String(data.get("name")),
      });
      setBuildings((current) => sortBuildings(uniqueBuildings([...current, building])));
      onStructuralRoleChange?.("COMPOSITE");
      form.reset();
      setMessage("Immeuble ajouté avec succès. La disponibilité de l’ensemble est désormais calculée unité par unité.");
    } catch (caught) {
      setError(toPropertyUiError(caught, "building"));
    } finally {
      setBusyKey(undefined);
    }
  }

  async function updateBuilding(event: FormEvent<HTMLFormElement>, buildingId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusyKey(`building-${buildingId}`);
    clearFeedback();
    try {
      const updated = await api.updateBuilding(property.propertyId, buildingId, {
        buildingCode: String(data.get("buildingCode")),
        name: String(data.get("name")),
      });
      setBuildings((current) => sortBuildings(current.map((item) => item.buildingId === buildingId ? updated : item)));
      setMessage("Immeuble modifié avec succès.");
    } catch (caught) {
      setError(toPropertyUiError(caught, "building"));
    } finally {
      setBusyKey(undefined);
    }
  }

  async function loadMoreBuildings() {
    if (!buildingCursor || loadingMore) return;
    setLoadingMore(true);
    setPageError(undefined);
    try {
      const page = await api.listBuildings(property.propertyId, buildingCursor);
      setBuildings((current) => sortBuildings(uniqueBuildings([...current, ...page.items])));
      setBuildingCursor(page.pageInfo.nextCursor);
      setHasMoreBuildings(page.pageInfo.hasNextPage);
    } catch (caught) {
      setPageError(`${toPropertyUiError(caught, "composition").message} Les immeubles déjà affichés restent disponibles.`);
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadUnits(buildingId: string, cursor?: string) {
    setUnits((current) => ({
      ...current,
      [buildingId]: { ...(current[buildingId] ?? emptyUnits()), loading: true, error: undefined },
    }));
    try {
      const page = await api.listUnits(property.propertyId, buildingId, cursor);
      setUnits((current) => {
        const previous = cursor ? current[buildingId]?.items ?? [] : [];
        return {
          ...current,
          [buildingId]: {
            items: sortUnits(uniqueUnits([...previous, ...page.items])),
            nextCursor: page.pageInfo.nextCursor,
            hasNextPage: page.pageInfo.hasNextPage,
            loading: false,
            loaded: true,
          },
        };
      });
    } catch (caught) {
      setUnits((current) => ({
        ...current,
        [buildingId]: {
          ...(current[buildingId] ?? emptyUnits()),
          loading: false,
          error: toPropertyUiError(caught, "unit"),
        },
      }));
    }
  }

  async function addUnit(event: FormEvent<HTMLFormElement>, buildingId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const description = String(data.get("description")).trim();
    setBusyKey(`create-unit-${buildingId}`);
    clearFeedback();
    try {
      const unit = await api.createUnit(property.propertyId, buildingId, {
        unitCode: String(data.get("unitCode")),
        title: String(data.get("title")),
        ...(description.length === 0 ? {} : { description }),
        propertyType: String(data.get("propertyType")) as Property["propertyType"],
        transactionType: String(data.get("transactionType")) as Property["transactionType"],
        ...(data.get("propertyType") === "APARTMENT" && data.get("transactionType") === "LONG_TERM_RENTAL"
          ? { apartmentSubtype: String(data.get("apartmentSubtype")) as "STUDIO" | "MULTI_ROOM" }
          : {}),
        location: {
          country: String(data.get("country")),
          city: String(data.get("city")),
          district: String(data.get("district")),
          addressLine: String(data.get("addressLine")),
        },
      });
      setUnits((current) => ({
        ...current,
        [buildingId]: {
          ...(current[buildingId] ?? emptyUnits()),
          items: sortUnits(uniqueUnits([...(current[buildingId]?.items ?? []), unit])),
          loaded: true,
        },
      }));
      form.reset();
      setMessage("Unité ajoutée avec succès.");
    } catch (caught) {
      setError(toPropertyUiError(caught, "unit"));
    } finally {
      setBusyKey(undefined);
    }
  }

  async function updateUnit(event: FormEvent<HTMLFormElement>, buildingId: string, unitPropertyId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusyKey(`unit-${unitPropertyId}`);
    clearFeedback();
    try {
      const updated = await api.updateUnitCode(property.propertyId, buildingId, unitPropertyId, String(data.get("unitCode")));
      setUnits((current) => ({
        ...current,
        [buildingId]: {
          ...(current[buildingId] ?? emptyUnits()),
          items: sortUnits((current[buildingId]?.items ?? []).map((item) => item.property.propertyId === unitPropertyId ? updated : item)),
        },
      }));
      setMessage("Code de l’unité modifié avec succès.");
    } catch (caught) {
      setError(toPropertyUiError(caught, "unit"));
    } finally {
      setBusyKey(undefined);
    }
  }

  if (property.structuralRole === "UNIT") return null;

  return (
    <section className="content-panel" aria-labelledby="composition-title" aria-busy={loading || loadingMore || busyKey !== undefined}>
      <div className="section-heading"><div><p className="eyebrow">Organisation</p><h2 id="composition-title">Composition du bien</h2></div></div>
      {message && <div className="form-message is-success" role="status">{message}</div>}
      {error && <div className="form-message" role="alert"><p>{error.message}</p>{buildings.length === 0 && <button type="button" className="secondary-action" onClick={() => void retryInitialBuildings()}>Réessayer de charger la composition</button>}</div>}
      {loading ? <p role="status">Chargement de la composition…</p> : (
        <>
          <form onSubmit={addBuilding}>
            <fieldset disabled={busyKey !== undefined}>
              <legend>Ajouter un immeuble</legend>
              <CodeField name="buildingCode" label="Code du nouvel immeuble" />
              <label>Nom du nouvel immeuble<input name="name" required maxLength={200} /></label>
              <button className="primary-action" type="submit">Ajouter l’immeuble</button>
            </fieldset>
          </form>
          {buildings.length === 0 ? <p>Aucun immeuble n’est encore rattaché à ce bien.</p> : (
            <ul className="composition-list">
              {buildings.map((building) => {
                const unitState = units[building.buildingId];
                return (
                  <li key={building.buildingId}>
                    <form onSubmit={(event) => void updateBuilding(event, building.buildingId)}>
                      <fieldset disabled={busyKey !== undefined}>
                        <legend>Modifier {building.name}</legend>
                        <CodeField name="buildingCode" label={`Code de ${building.name}`} defaultValue={building.buildingCode} />
                        <label>Nom de l’immeuble<input name="name" required maxLength={200} defaultValue={building.name} /></label>
                        <button className="secondary-action" type="submit">Enregistrer l’immeuble</button>
                      </fieldset>
                    </form>
                    <button type="button" className="secondary-action" onClick={() => void loadUnits(building.buildingId)} disabled={unitState?.loading}>
                      {unitState?.loading && !unitState.loaded ? "Chargement…" : unitState?.loaded ? "Actualiser les unités" : "Afficher les unités"}
                    </button>
                    <form onSubmit={(event) => void addUnit(event, building.buildingId)}>
                      <fieldset disabled={busyKey !== undefined}>
                        <legend>Ajouter une unité à {building.name}</legend>
                        <CodeField name="unitCode" label="Code de la nouvelle unité" />
                        <label>Titre de l’unité<input name="title" required maxLength={200} /></label>
                        <label>Description de l’unité<textarea name="description" maxLength={5_000} /></label>
                        <label>Type<select name="propertyType"><option value="APARTMENT">Appartement</option><option value="HOUSE">Maison</option><option value="LAND">Terrain</option><option value="COMMERCIAL">Local commercial</option><option value="OTHER">Autre</option></select></label>
                        <label>Projet<select name="transactionType"><option value="LONG_TERM_RENTAL">Location longue durée</option><option value="SHORT_TERM_RENTAL">Location courte durée</option><option value="SALE">Vente</option></select></label>
                        <label>Sous-type d’appartement<select name="apartmentSubtype" defaultValue="STUDIO"><option value="STUDIO">Studio</option><option value="MULTI_ROOM">Plusieurs pièces</option></select></label>
                        <fieldset>
                          <legend>Localisation de l’unité</legend>
                          <label>Pays de l’unité<input name="country" required minLength={2} maxLength={2} pattern="[A-Z]{2}" defaultValue={property.location.country} /></label>
                          <label>Ville de l’unité<input name="city" required maxLength={200} defaultValue={property.location.city} /></label>
                          <label>Quartier de l’unité<input name="district" required maxLength={200} defaultValue={property.location.district} /></label>
                          <label>Adresse de l’unité<input name="addressLine" required maxLength={200} defaultValue={property.location.addressLine} /></label>
                        </fieldset>
                        <button type="submit" className="primary-action">Ajouter l’unité</button>
                      </fieldset>
                    </form>
                    {unitState?.loading && unitState.loaded && <p role="status">Chargement des unités suivantes…</p>}
                    {unitState?.error && <div className="form-message" role="alert"><p>{unitState.error.message} Les unités déjà affichées restent disponibles.</p><button type="button" className="secondary-action" onClick={() => void loadUnits(building.buildingId)}>Réessayer de charger les unités</button></div>}
                    {unitState?.loaded && unitState.items.length === 0 && <p>Aucune unité dans cet immeuble.</p>}
                    <ul>
                      {(unitState?.items ?? []).map((unit) => (
                        <li key={unit.property.propertyId}>
                          <article aria-label={`Unité ${unit.unitCode}`}>
                            <h3>{unit.unitCode} — {unit.property.title}</h3>
                            <dl className="definition-grid">
                              <div><dt>Type</dt><dd>{propertyTypeLabels[unit.property.propertyType]}</dd></div>
                              <div><dt>Projet</dt><dd>{transactionTypeLabels[unit.property.transactionType]}</dd></div>
                              <div><dt>Adresse</dt><dd>{formatLocation(unit.property)}</dd></div>
                            </dl>
                            <form onSubmit={(event) => void updateUnit(event, building.buildingId, unit.property.propertyId)}>
                              <fieldset disabled={busyKey !== undefined}>
                                <legend>Modifier le code de {unit.property.title}</legend>
                                <CodeField name="unitCode" label={`Code de ${unit.property.title}`} defaultValue={unit.unitCode} />
                                <button className="secondary-action" type="submit">Enregistrer le code</button>{" "}
                                <Link to={`/properties/${unit.property.propertyId}`}>Ouvrir la fiche</Link>
                              </fieldset>
                            </form>
                            <PropertyAvailabilitySection
                              propertyId={unit.property.propertyId}
                              transactionType={unit.property.transactionType}
                              api={api}
                              compact
                              label={`Disponibilité de l’unité ${unit.unitCode}`}
                            />
                          </article>
                        </li>
                      ))}
                    </ul>
                    {unitState?.hasNextPage && <button type="button" className="secondary-action" disabled={unitState.loading} onClick={() => void loadUnits(building.buildingId, unitState.nextCursor ?? undefined)}>Afficher plus d’unités</button>}
                  </li>
                );
              })}
            </ul>
          )}
          {pageError && <div className="form-message" role="alert">{pageError}</div>}
          {hasMoreBuildings && <button type="button" className="secondary-action" disabled={loadingMore} onClick={() => void loadMoreBuildings()}>{loadingMore ? "Chargement…" : "Afficher plus d’immeubles"}</button>}
        </>
      )}
    </section>
  );
}

function CodeField({ name, label, defaultValue }: Readonly<{ name: string; label: string; defaultValue?: string }>) {
  return <label>{label}<input name={name} required minLength={1} maxLength={50} pattern={CODE_PATTERN} title="Utilisez des lettres, chiffres, espaces, points, tirets, barres obliques ou caractères de soulignement." defaultValue={defaultValue} /></label>;
}

function formatLocation(property: Property) {
  return `${property.location.addressLine}, ${property.location.district}, ${property.location.city} (${property.location.country})`;
}

function uniqueBuildings(items: readonly PropertyBuilding[]) { return [...new Map(items.map((item) => [item.buildingId, item])).values()]; }
function uniqueUnits(items: readonly PropertyUnit[]) { return [...new Map(items.map((item) => [item.property.propertyId, item])).values()]; }
function sortBuildings(items: readonly PropertyBuilding[]) { return [...items].sort((a, b) => a.buildingCode.localeCompare(b.buildingCode) || a.buildingId.localeCompare(b.buildingId)); }
function sortUnits(items: readonly PropertyUnit[]) { return [...items].sort((a, b) => a.unitCode.localeCompare(b.unitCode) || a.property.propertyId.localeCompare(b.property.propertyId)); }
