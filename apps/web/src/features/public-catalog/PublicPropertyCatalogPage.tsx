import { lazy, Suspense, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { createPublicPropertyApi } from "./public-property-api.js";
import { parsePublicCatalogSearchParams, serializePublicCatalogUrlState } from "./public-catalog-search.js";
import { formatCatalogMoney, majorAmountToMinor, minorAmountToMajorInput } from "./public-catalog-money.js";
import { dateInputToUtcInstant, formatStayInterval, utcInstantToDateInput } from "./public-catalog-date.js";
import {
  formatPublicPropertyPrice,
  publicPropertyTypes,
  propertyStructuralRoleLabels,
  propertyTypeLabels,
  transactionTypeLabels,
  type PropertyStructuralRole,
  type PublicPropertySummary,
  type PublicCountryReference,
  type PublicCurrencyReference,
  type PublicCatalogSort,
  type PropertyType,
  type TransactionType,
} from "./public-property-model.js";
import { PublicCatalogLayout } from "./PublicCatalogLayout.js";
import { Alert, Button, EmptyState, Field, LoadingState, StatusBadge } from "../../ui/index.js";

const api = createPublicPropertyApi();
const transactionTypes = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] as const;
const structuralRoles = ["STANDALONE", "COMPOSITE", "UNIT"] as const;
const LazyPublicCatalogMap = lazy(async () => ({ default: (await import("./PublicCatalogMap.js")).PublicCatalogMap }));

export function PublicPropertyCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedSearch = useMemo(() => parsePublicCatalogSearchParams(searchParams), [searchParams]);
  const [propertyTypes, setPropertyTypes] = useState<readonly PropertyType[]>(parsedSearch.propertyTypes ?? []);
  const [selectedTransactionTypes, setSelectedTransactionTypes] = useState<readonly TransactionType[]>(parsedSearch.transactionTypes ?? []);
  const [selectedStructuralRoles, setSelectedStructuralRoles] = useState<readonly PropertyStructuralRole[]>(parsedSearch.structuralRoles ?? []);
  const [minBedrooms, setMinBedrooms] = useState(valueForInput(parsedSearch.minBedrooms));
  const [maxBedrooms, setMaxBedrooms] = useState(valueForInput(parsedSearch.maxBedrooms));
  const [bedroomError, setBedroomError] = useState<string>();
  const [currencyCode, setCurrencyCode] = useState(parsedSearch.currencyCode ?? "");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [priceError, setPriceError] = useState<string>();
  const [currencyError, setCurrencyError] = useState<string>();
  const [arrivalDate, setArrivalDate] = useState(utcInstantToDateInput(parsedSearch.availableFrom));
  const [departureDate, setDepartureDate] = useState(utcInstantToDateInput(parsedSearch.availableTo));
  const [dateError, setDateError] = useState<string>();
  const [countryCode, setCountryCode] = useState(parsedSearch.countryCode ?? "");
  const [city, setCity] = useState(parsedSearch.city ?? "");
  const [commune, setCommune] = useState(parsedSearch.commune ?? "");
  const [quartier, setQuartier] = useState(parsedSearch.quartier ?? "");
  const [q, setQ] = useState(parsedSearch.q ?? "");
  const [countries, setCountries] = useState<readonly PublicCountryReference[]>([]);
  const [countriesRequested, setCountriesRequested] = useState(false);
  const [currencies, setCurrencies] = useState<readonly PublicCurrencyReference[]>([]);
  const [currenciesRequested, setCurrenciesRequested] = useState(false);
  const [items, setItems] = useState<readonly PublicPropertySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>();
  const [mobileMode, setMobileMode] = useState<"LIST" | "MAP">("LIST");
  const desktopLayout = useDesktopCatalogLayout();
  const currentSearch = searchParams.toString();
  const mapMarkers = useMemo(() => items.map((property) => ({ property, label: formatPublicPropertyPrice(property.commercialTerms) })), [items]);

  const criteria = parsedSearch;

  const load = useCallback(async (append: boolean) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(false);
    try {
      const page = await api.list({ ...criteria, ...(append && nextCursor !== null ? { cursor: nextCursor } : {}) });
      setItems((current) => append ? deduplicate([...current, ...page.items]) : page.items);
      setNextCursor(page.pageInfo.nextCursor);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch {
      setError(true);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [criteria, nextCursor]);

  useEffect(() => {
    setPropertyTypes(parsedSearch.propertyTypes ?? []);
    setSelectedTransactionTypes(parsedSearch.availableFrom === undefined ? parsedSearch.transactionTypes ?? [] : ["SHORT_TERM_RENTAL"]);
    setSelectedStructuralRoles(parsedSearch.structuralRoles ?? []);
    setMinBedrooms(valueForInput(parsedSearch.minBedrooms));
    setMaxBedrooms(valueForInput(parsedSearch.maxBedrooms));
    setBedroomError(undefined);
    setCurrencyCode(parsedSearch.currencyCode ?? "");
    const restoredCurrency = currencies.find((currency) => currency.code === parsedSearch.currencyCode);
    setMinimumPrice(restoredCurrency === undefined || parsedSearch.minPriceAmountMinor === undefined ? "" : minorAmountToMajorInput(parsedSearch.minPriceAmountMinor, restoredCurrency) ?? "");
    setMaximumPrice(restoredCurrency === undefined || parsedSearch.maxPriceAmountMinor === undefined ? "" : minorAmountToMajorInput(parsedSearch.maxPriceAmountMinor, restoredCurrency) ?? "");
    setPriceError(undefined);
    setCurrencyError(undefined);
    setArrivalDate(utcInstantToDateInput(parsedSearch.availableFrom));
    setDepartureDate(utcInstantToDateInput(parsedSearch.availableTo));
    setDateError(undefined);
    if (parsedSearch.currencyCode !== undefined && !currenciesRequested) void loadCurrencies();
    setCountryCode(parsedSearch.countryCode ?? "");
    setCity(parsedSearch.city ?? "");
    setCommune(parsedSearch.commune ?? "");
    setQuartier(parsedSearch.quartier ?? "");
    setQ(parsedSearch.q ?? "");
    setItems([]);
    setSelectedPropertyId(undefined);
    setNextCursor(null);
    setHasNextPage(false);
    void load(false);
    // `load` contains the current cursor for pagination; filters alone trigger an initial reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearch]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedMinimum = parseBedroomBound(minBedrooms);
    const parsedMaximum = parseBedroomBound(maxBedrooms);
    if (parsedMinimum === null || parsedMaximum === null) {
      setBedroomError("Saisissez un nombre entier compris entre 0 et 100.");
      return;
    }
    if (parsedMinimum !== undefined && parsedMaximum !== undefined && parsedMinimum > parsedMaximum) {
      setBedroomError("Le minimum de chambres doit être inférieur ou égal au maximum.");
      return;
    }
    const hasPrice = minimumPrice.trim() !== "" || maximumPrice.trim() !== "";
    const selectedCurrency = currencies.find((currency) => currency.code === currencyCode);
    if (hasPrice && selectedCurrency === undefined) {
      setCurrencyError("Sélectionnez une devise pour filtrer les prix.");
      return;
    }
    const parsedMinimumPrice = selectedCurrency === undefined ? undefined : majorAmountToMinor(minimumPrice, selectedCurrency);
    const parsedMaximumPrice = selectedCurrency === undefined ? undefined : majorAmountToMinor(maximumPrice, selectedCurrency);
    if ((minimumPrice.trim() !== "" && parsedMinimumPrice === undefined) || (maximumPrice.trim() !== "" && parsedMaximumPrice === undefined)) {
      setPriceError("Saisissez un montant positif avec le nombre de décimales autorisé par la devise.");
      return;
    }
    if (parsedMinimumPrice !== undefined && parsedMaximumPrice !== undefined && parsedMinimumPrice > parsedMaximumPrice) {
      setPriceError("Le prix minimum doit être inférieur ou égal au prix maximum.");
      return;
    }
    const hasArrival = arrivalDate !== "";
    const hasDeparture = departureDate !== "";
    if (hasArrival !== hasDeparture) {
      setDateError("Renseignez une date d’arrivée et une date de départ.");
      return;
    }
    const availableFrom = hasArrival ? dateInputToUtcInstant(arrivalDate) : undefined;
    const availableTo = hasDeparture ? dateInputToUtcInstant(departureDate) : undefined;
    if ((hasArrival && availableFrom === undefined) || (hasDeparture && availableTo === undefined)) {
      setDateError("Saisissez des dates valides.");
      return;
    }
    if (availableFrom !== undefined && availableTo !== undefined && availableFrom >= availableTo) {
      setDateError("La date de départ doit être postérieure à la date d’arrivée.");
      return;
    }
    setBedroomError(undefined);
    setPriceError(undefined);
    setCurrencyError(undefined);
    setDateError(undefined);
    setSearchParams(serializePublicCatalogUrlState({
      ...parsedSearch,
      propertyTypes: propertyTypes.length === 0 ? undefined : propertyTypes,
      transactionTypes: availableFrom === undefined
        ? (selectedTransactionTypes.length === 0 ? undefined : selectedTransactionTypes)
        : ["SHORT_TERM_RENTAL"],
      structuralRoles: selectedStructuralRoles.length === 0 ? undefined : selectedStructuralRoles,
      minBedrooms: parsedMinimum,
      maxBedrooms: parsedMaximum,
      minPriceAmountMinor: parsedMinimumPrice,
      maxPriceAmountMinor: parsedMaximumPrice,
      currencyCode: currencyCode || undefined,
      availableFrom,
      availableTo,
      countryCode: countryCode.trim().toUpperCase() || undefined,
      city: city.trim() || undefined,
      commune: commune.trim() || undefined,
      quartier: quartier.trim() || undefined,
      q: q.trim() || undefined,
    }));
  }

  function resetSearch() {
    setSearchParams(serializePublicCatalogUrlState({
      ...parsedSearch,
      countryCode: undefined, city: undefined, commune: undefined, quartier: undefined, q: undefined,
      propertyTypes: undefined, transactionTypes: undefined, structuralRoles: undefined,
      minBedrooms: undefined, maxBedrooms: undefined,
      minPriceAmountMinor: undefined, maxPriceAmountMinor: undefined, currencyCode: undefined,
      availableFrom: undefined, availableTo: undefined, sort: undefined,
    }));
  }

  function removeAppliedFilter(filter: ActiveFilter) {
    const next = { ...parsedSearch };
    if (filter.key === "availableFrom") {
      delete next.availableFrom;
      delete next.availableTo;
    } else if (filter.key === "currencyCode") {
      delete next.currencyCode;
      delete next.minPriceAmountMinor;
      delete next.maxPriceAmountMinor;
    } else if (filter.value === undefined) {
      delete next[filter.key];
    } else {
      const remaining = (next[filter.key] as readonly string[] | undefined)?.filter((value) => value !== filter.value);
      Object.assign(next, { [filter.key]: remaining?.length === 0 ? undefined : remaining });
    }
    setSearchParams(serializePublicCatalogUrlState(next));
  }

  async function loadCountries() {
    if (countriesRequested) return;
    setCountriesRequested(true);
    try { setCountries(await api.listCountries()); } catch { setCountries([]); }
  }

  async function loadCurrencies() {
    if (currenciesRequested) return;
    setCurrenciesRequested(true);
    try {
      const loaded = await api.listCurrencies();
      setCurrencies(loaded);
      const restoredCurrency = loaded.find((currency) => currency.code === parsedSearch.currencyCode);
      if (restoredCurrency !== undefined) {
        setMinimumPrice(parsedSearch.minPriceAmountMinor === undefined ? "" : minorAmountToMajorInput(parsedSearch.minPriceAmountMinor, restoredCurrency) ?? "");
        setMaximumPrice(parsedSearch.maxPriceAmountMinor === undefined ? "" : minorAmountToMajorInput(parsedSearch.maxPriceAmountMinor, restoredCurrency) ?? "");
      }
    } catch { setCurrencies([]); }
  }

  function updateStayDate(kind: "arrival" | "departure", value: string) {
    kind === "arrival" ? setArrivalDate(value) : setDepartureDate(value);
    setDateError(undefined);
    if (value !== "") setSelectedTransactionTypes(["SHORT_TERM_RENTAL"]);
  }

  function applySort(sort: PublicCatalogSort) {
    setSearchParams(serializePublicCatalogUrlState({ ...parsedSearch, sort: sort === "NEWEST" ? undefined : sort }));
  }

  const activeFilters = appliedFilters(parsedSearch, currencies);

  return (
    <PublicCatalogLayout>
      <section className="public-catalog-hero">
        <p className="eyebrow">Catalogue immobilier</p>
        <h1>Des biens prêts à accueillir vos projets</h1>
        <p>Découvrez les biens publiés par cette organisation, sans créer de compte.</p>
      </section>

      <section className="public-catalog-section" aria-labelledby="catalogue-title">
        <div className="public-section-heading">
          <div><p className="eyebrow">Sélection publiée</p><h2 id="catalogue-title">Biens publiés</h2></div>
        </div>
        <form className="public-catalog-filters public-catalog-search" onSubmit={applyFilters} aria-label="Rechercher dans le catalogue" noValidate>
          <Field label="Recherche" optional><input type="search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Titre, description ou lieu" maxLength={200} /></Field>
          <fieldset className="public-geography-fields">
            <legend>Localisation</legend>
            <Field label="Pays" optional><input value={countryCode} onChange={(event) => setCountryCode(event.target.value)} onFocus={() => void loadCountries()} list="public-country-options" maxLength={2} autoComplete="country" placeholder="Code pays" /></Field>
            <datalist id="public-country-options">{countries.map((country) => <option key={country.code} value={country.code}>{countryName(country.code)}</option>)}</datalist>
            <Field label="Ville" optional><input value={city} onChange={(event) => setCity(event.target.value)} maxLength={200} autoComplete="address-level2" /></Field>
            <Field label="Commune" optional><input value={commune} onChange={(event) => setCommune(event.target.value)} maxLength={200} autoComplete="address-level3" /></Field>
            <Field label="Quartier" optional><input value={quartier} onChange={(event) => setQuartier(event.target.value)} maxLength={200} autoComplete="address-level4" /></Field>
          </fieldset>
          <details className="public-advanced-filters">
            <summary>Plus de filtres{activeFilters.some((filter) => filter.group === "advanced") ? ` (${activeFilters.filter((filter) => filter.group === "advanced").length})` : ""}</summary>
            <div className="public-advanced-filter-grid">
              <fieldset><legend>Projet immobilier</legend>{transactionTypes.map((value) => <label className="public-filter-option" key={value}><input type="checkbox" checked={selectedTransactionTypes.includes(value)} disabled={(arrivalDate !== "" || departureDate !== "") && value !== "SHORT_TERM_RENTAL"} onChange={() => setSelectedTransactionTypes(toggleValue(selectedTransactionTypes, value))} />{transactionTypeLabels[value]}</label>)}</fieldset>
              <fieldset><legend>Type de bien</legend>{publicPropertyTypes.map((value) => <label className="public-filter-option" key={value}><input type="checkbox" checked={propertyTypes.includes(value)} onChange={() => setPropertyTypes(toggleValue(propertyTypes, value))} />{propertyTypeLabels[value]}</label>)}</fieldset>
              <fieldset><legend>Configuration</legend>{structuralRoles.map((value) => <label className="public-filter-option" key={value}><input type="checkbox" checked={selectedStructuralRoles.includes(value)} onChange={() => setSelectedStructuralRoles(toggleValue(selectedStructuralRoles, value))} />{propertyStructuralRoleLabels[value]}</label>)}</fieldset>
              <fieldset className="public-bedroom-fields"><legend>Chambres</legend><Field label="Minimum" optional error={bedroomError}><input type="number" inputMode="numeric" min="0" max="100" step="1" value={minBedrooms} onChange={(event) => { setMinBedrooms(event.target.value); setBedroomError(undefined); }} /></Field><Field label="Maximum" optional><input type="number" inputMode="numeric" min="0" max="100" step="1" value={maxBedrooms} onChange={(event) => { setMaxBedrooms(event.target.value); setBedroomError(undefined); }} /></Field></fieldset>
              <fieldset className="public-price-fields"><legend>Prix</legend><Field label="Devise" optional error={currencyError}><select value={currencyCode} onFocus={() => void loadCurrencies()} onChange={(event) => { setCurrencyCode(event.target.value); setCurrencyError(undefined); setPriceError(undefined); }}><option value="">Sélectionner une devise</option>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}</select></Field><Field label="Prix minimum" optional error={priceError}><input type="text" inputMode="decimal" value={minimumPrice} onChange={(event) => { setMinimumPrice(event.target.value); setPriceError(undefined); }} /></Field><Field label="Prix maximum" optional><input type="text" inputMode="decimal" value={maximumPrice} onChange={(event) => { setMaximumPrice(event.target.value); setPriceError(undefined); }} /></Field></fieldset>
              <fieldset className="public-stay-fields"><legend>Séjour en location courte durée</legend><Field label="Arrivée" optional error={dateError}><input type="date" value={arrivalDate} onChange={(event) => updateStayDate("arrival", event.target.value)} /></Field><Field label="Départ" optional><input type="date" value={departureDate} onChange={(event) => updateStayDate("departure", event.target.value)} /></Field></fieldset>
            </div>
          </details>
          <div className="public-filter-actions"><Button className="public-filter-action" type="submit">Rechercher</Button><Button type="button" variant="secondary" onClick={resetSearch}>Effacer tous les filtres</Button></div>
        </form>
        {activeFilters.length > 0 ? <div className="public-active-filters" aria-live="polite"><span>Filtres actifs :</span>{activeFilters.map((filter) => <button type="button" key={`${filter.key}-${filter.value ?? "single"}`} onClick={() => removeAppliedFilter(filter)} aria-label={`Retirer le filtre ${filter.label}`}>{filter.label}<span aria-hidden="true">×</span></button>)}</div> : null}

        <div className="public-result-toolbar"><label htmlFor="public-catalog-sort">Trier les résultats</label><select id="public-catalog-sort" value={parsedSearch.sort ?? "NEWEST"} onChange={(event) => applySort(event.target.value as PublicCatalogSort)}><option value="NEWEST">Plus récents</option><option value="PRICE_ASC">Prix croissant</option><option value="PRICE_DESC">Prix décroissant</option></select></div>

        {loading ? <LoadingState label="Chargement des biens…" /> : null}
        {!loading && error ? (
          <Alert tone="danger" title="Le catalogue est momentanément indisponible"><p>Veuillez réessayer dans un instant.</p><Button variant="secondary" onClick={() => void load(items.length > 0)}>Réessayer</Button></Alert>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState title="Aucun bien ne correspond à cette sélection" description="Modifiez les filtres pour découvrir d’autres biens publiés." />
        ) : null}
        {items.length > 0 && desktopLayout ? <div className="public-catalog-discovery">
          <PublicCatalogList items={items} catalogSearch={currentSearch} selectedPropertyId={selectedPropertyId} onSelect={setSelectedPropertyId} showPagination={!loading && !error && hasNextPage} loadingMore={loadingMore} onLoadMore={() => void load(true)} />
          <aside className="public-catalog-map-column" aria-label="Localisation des résultats"><PublicCatalogMapSurface markers={mapMarkers} selectedPropertyId={selectedPropertyId} catalogSearch={currentSearch} onSelect={setSelectedPropertyId} onClearSelection={() => setSelectedPropertyId(undefined)} /></aside>
        </div> : null}
        {items.length > 0 && !desktopLayout ? <div className="public-catalog-mobile">
          <div className="public-catalog-mode-toggle" role="group" aria-label="Affichage des résultats">
            <button type="button" aria-pressed={mobileMode === "LIST"} onClick={() => setMobileMode("LIST")}>Liste</button>
            <button type="button" aria-pressed={mobileMode === "MAP"} onClick={() => setMobileMode("MAP")}>Carte</button>
          </div>
          {mobileMode === "LIST"
            ? <PublicCatalogList items={items} catalogSearch={currentSearch} selectedPropertyId={selectedPropertyId} onSelect={setSelectedPropertyId} showPagination={!loading && !error && hasNextPage} loadingMore={loadingMore} onLoadMore={() => void load(true)} />
            : <div className="public-catalog-mobile-map"><PublicCatalogMapSurface markers={mapMarkers} selectedPropertyId={selectedPropertyId} catalogSearch={currentSearch} onSelect={setSelectedPropertyId} onClearSelection={() => setSelectedPropertyId(undefined)} /></div>}
        </div> : null}
      </section>
    </PublicCatalogLayout>
  );
}

function countryName(code: string): string {
  try { return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

type FilterArrayKey = "propertyTypes" | "transactionTypes" | "structuralRoles";
type FilterScalarKey = "countryCode" | "city" | "commune" | "quartier" | "q" | "minBedrooms" | "maxBedrooms" | "minPriceAmountMinor" | "maxPriceAmountMinor" | "currencyCode" | "availableFrom";
type ActiveFilter = Readonly<{ key: FilterArrayKey | FilterScalarKey; value?: string; label: string; group: "primary" | "advanced" }>;

function appliedFilters(criteria: ReturnType<typeof parsePublicCatalogSearchParams>, currencies: readonly PublicCurrencyReference[]): readonly ActiveFilter[] {
  const currency = currencies.find((candidate) => candidate.code === criteria.currencyCode);
  return [
    ...scalarFilters(criteria),
    ...(criteria.transactionTypes ?? []).map((value) => ({ key: "transactionTypes" as const, value, label: transactionTypeLabels[value], group: "advanced" as const })),
    ...(criteria.propertyTypes ?? []).map((value) => ({ key: "propertyTypes" as const, value, label: propertyTypeLabels[value], group: "advanced" as const })),
    ...(criteria.structuralRoles ?? []).map((value) => ({ key: "structuralRoles" as const, value, label: propertyStructuralRoleLabels[value], group: "advanced" as const })),
    ...(criteria.minBedrooms === undefined ? [] : [{ key: "minBedrooms" as const, label: `${criteria.minBedrooms} chambre(s) minimum`, group: "advanced" as const }]),
    ...(criteria.maxBedrooms === undefined ? [] : [{ key: "maxBedrooms" as const, label: `${criteria.maxBedrooms} chambre(s) maximum`, group: "advanced" as const }]),
    ...(criteria.minPriceAmountMinor === undefined ? [] : [{ key: "minPriceAmountMinor" as const, label: currency === undefined ? "Prix minimum" : `Prix min. ${formatCatalogMoney(criteria.minPriceAmountMinor, currency)}`, group: "advanced" as const }]),
    ...(criteria.maxPriceAmountMinor === undefined ? [] : [{ key: "maxPriceAmountMinor" as const, label: currency === undefined ? "Prix maximum" : `Prix max. ${formatCatalogMoney(criteria.maxPriceAmountMinor, currency)}`, group: "advanced" as const }]),
    ...(criteria.currencyCode === undefined ? [] : [{ key: "currencyCode" as const, label: `Devise : ${criteria.currencyCode}`, group: "advanced" as const }]),
    ...(criteria.availableFrom === undefined || criteria.availableTo === undefined ? [] : [{ key: "availableFrom" as const, label: `Séjour : ${formatStayInterval(criteria.availableFrom, criteria.availableTo)}`, group: "advanced" as const }]),
  ];
}

function scalarFilters(criteria: ReturnType<typeof parsePublicCatalogSearchParams>): readonly ActiveFilter[] {
  const values: readonly [FilterScalarKey, string | number | undefined, string][] = [
    ["countryCode", criteria.countryCode, "Pays"], ["city", criteria.city, "Ville"],
    ["commune", criteria.commune, "Commune"], ["quartier", criteria.quartier, "Quartier"], ["q", criteria.q, "Recherche"],
  ];
  return values.flatMap(([key, value, prefix]) => value === undefined ? [] : [{ key, label: `${prefix} : ${value}`, group: "primary" as const }]);
}

function toggleValue<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
}

function valueForInput(value: number | undefined): string { return value === undefined ? "" : String(value); }

function parseBedroomBound(value: string): number | undefined | null {
  if (value === "") return undefined;
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 100 ? parsed : null;
}

function PublicPropertyCard({ property, catalogSearch, selected, onSelect }: Readonly<{ property: PublicPropertySummary; catalogSearch: string; selected: boolean; onSelect: (propertyId: string) => void }>) {
  return (
    <article className={`public-property-card${selected ? " is-selected" : ""}`} onMouseEnter={() => onSelect(property.publicPropertyId)} onFocus={() => onSelect(property.publicPropertyId)}>
      <div className="public-property-photo">
        {property.primaryPhoto === null
          ? <div className="public-photo-placeholder" role="img" aria-label={`Aucune photo disponible pour ${property.title}`}><span aria-hidden="true">⌂</span></div>
          : <img src={api.photoUrl(property.primaryPhoto.url)} alt={`Photo principale de ${property.title}`} />}
      </div>
      <div className="public-property-card-body">
        <div className="public-property-badges">
          <StatusBadge tone="info">{propertyTypeLabels[property.propertyType]}</StatusBadge><StatusBadge>{transactionTypeLabels[property.transactionType]}</StatusBadge>
        </div>
        <h3>{property.title}</h3>
        <p className="public-property-location">{property.location.city} · {property.location.district}</p>
        <p className="public-property-price">{formatPublicPropertyPrice(property.commercialTerms)}</p>
        <p className="public-property-role">{propertyStructuralRoleLabels[property.structuralRole]}</p>
        <Link className="public-property-link" to={`/catalogue/${property.publicPropertyId}`} state={{ catalogSearch }}>
          Consulter le bien <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

interface PublicCatalogListProps {
  readonly items: readonly PublicPropertySummary[];
  readonly catalogSearch: string;
  readonly selectedPropertyId?: string;
  readonly onSelect: (propertyId: string) => void;
  readonly showPagination: boolean;
  readonly loadingMore: boolean;
  readonly onLoadMore: () => void;
}

function PublicCatalogList({ items, catalogSearch, selectedPropertyId, onSelect, showPagination, loadingMore, onLoadMore }: PublicCatalogListProps) {
  return <div className="public-catalog-list"><ul className="public-catalog-grid">{items.map((property) => (
    <li key={property.publicPropertyId}><PublicPropertyCard property={property} catalogSearch={catalogSearch} selected={selectedPropertyId === property.publicPropertyId} onSelect={onSelect} /></li>
  ))}</ul>{showPagination ? <div className="public-catalog-pagination"><Button variant="secondary" loading={loadingMore} loadingLabel="Chargement…" onClick={onLoadMore}>Afficher plus de biens</Button></div> : null}</div>;
}

function PublicCatalogMapSurface({ markers, selectedPropertyId, catalogSearch, onSelect, onClearSelection }: Readonly<{
  markers: readonly { readonly property: PublicPropertySummary; readonly label: string }[];
  selectedPropertyId?: string;
  catalogSearch: string;
  onSelect: (propertyId: string) => void;
  onClearSelection: () => void;
}>) {
  return markers.some(({ property }) => property.publicLocation !== null) ? <Suspense fallback={<LoadingState label="Chargement de la carte…" />}>
    <LazyPublicCatalogMap markers={markers} selectedPropertyId={selectedPropertyId} catalogSearch={catalogSearch} onSelect={onSelect} onClearSelection={onClearSelection} />
  </Suspense> : <div className="public-catalog-map-empty" role="status">Aucune position publique n’est disponible pour les biens affichés.</div>;
}

function useDesktopCatalogLayout(): boolean {
  const query = "(min-width: 64.0625rem)";
  const [desktop, setDesktop] = useState(() => typeof window.matchMedia !== "function" || window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

function deduplicate(items: readonly PublicPropertySummary[]): readonly PublicPropertySummary[] {
  return [...new Map(items.map((item) => [item.publicPropertyId, item])).values()];
}
