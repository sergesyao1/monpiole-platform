import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { createPublicPropertyApi } from "./public-property-api.js";
import {
  formatPublicPropertyPrice,
  propertyStructuralRoleLabels,
  propertyTypeLabels,
  transactionTypeLabels,
  type PublicPropertySummary,
  type PropertyType,
  type TransactionType,
} from "./public-property-model.js";
import { PublicCatalogLayout } from "./PublicCatalogLayout.js";

const api = createPublicPropertyApi();
const propertyTypes = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
const transactionTypes = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] as const;

export function PublicPropertyCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedType = validPropertyType(searchParams.get("type"));
  const selectedTransaction = validTransactionType(searchParams.get("transactionType"));
  const [type, setType] = useState<PropertyType | "">(selectedType ?? "");
  const [transactionType, setTransactionType] = useState<TransactionType | "">(selectedTransaction ?? "");
  const [items, setItems] = useState<readonly PublicPropertySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const currentSearch = searchParams.toString();

  const criteria = useMemo(() => ({
    ...(selectedType === undefined ? {} : { type: selectedType }),
    ...(selectedTransaction === undefined ? {} : { transactionType: selectedTransaction }),
  }), [selectedType, selectedTransaction]);

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
    setType(selectedType ?? "");
    setTransactionType(selectedTransaction ?? "");
    setItems([]);
    setNextCursor(null);
    setHasNextPage(false);
    void load(false);
    // `load` contains the current cursor for pagination; filters alone trigger an initial reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, selectedTransaction]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (type !== "") next.set("type", type);
    if (transactionType !== "") next.set("transactionType", transactionType);
    setSearchParams(next);
  }

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
        <form className="public-catalog-filters" onSubmit={applyFilters}>
          <label>Type de bien
            <select value={type} onChange={(event) => setType(event.target.value as PropertyType | "")}>
              <option value="">Tous les types</option>
              {propertyTypes.map((value) => <option key={value} value={value}>{propertyTypeLabels[value]}</option>)}
            </select>
          </label>
          <label>Projet
            <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as TransactionType | "")}>
              <option value="">Tous les projets</option>
              {transactionTypes.map((value) => <option key={value} value={value}>{transactionTypeLabels[value]}</option>)}
            </select>
          </label>
          <button className="primary-action public-filter-action" type="submit">Afficher la sélection</button>
        </form>

        {loading ? <div className="public-catalog-state" role="status"><span className="loading-indicator" aria-hidden="true" />Chargement des biens…</div> : null}
        {!loading && error ? (
          <div className="public-catalog-state" role="alert">
            <h3>Le catalogue est momentanément indisponible</h3>
            <p>Veuillez réessayer dans un instant.</p>
            <button className="secondary-action" type="button" onClick={() => void load(items.length > 0)}>Réessayer</button>
          </div>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <div className="public-catalog-state public-catalog-empty">
            <h3>Aucun bien ne correspond à cette sélection</h3>
            <p>Modifiez les filtres pour découvrir d’autres biens publiés.</p>
          </div>
        ) : null}
        {items.length > 0 ? (
          <ul className="public-catalog-grid">
            {items.map((property) => (
              <li key={property.publicPropertyId}><PublicPropertyCard property={property} catalogSearch={currentSearch} /></li>
            ))}
          </ul>
        ) : null}
        {!loading && !error && hasNextPage ? (
          <div className="public-catalog-pagination">
            <button className="secondary-action" type="button" disabled={loadingMore} onClick={() => void load(true)}>
              {loadingMore ? "Chargement…" : "Afficher plus de biens"}
            </button>
          </div>
        ) : null}
      </section>
    </PublicCatalogLayout>
  );
}

function PublicPropertyCard({ property, catalogSearch }: Readonly<{ property: PublicPropertySummary; catalogSearch: string }>) {
  return (
    <article className="public-property-card">
      <div className="public-property-photo">
        {property.primaryPhoto === null
          ? <div className="public-photo-placeholder" role="img" aria-label={`Aucune photo disponible pour ${property.title}`}><span aria-hidden="true">⌂</span></div>
          : <img src={api.photoUrl(property.primaryPhoto.url)} alt={`Photo principale de ${property.title}`} />}
      </div>
      <div className="public-property-card-body">
        <div className="public-property-badges">
          <span>{propertyTypeLabels[property.propertyType]}</span><span>{transactionTypeLabels[property.transactionType]}</span>
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

function deduplicate(items: readonly PublicPropertySummary[]): readonly PublicPropertySummary[] {
  return [...new Map(items.map((item) => [item.publicPropertyId, item])).values()];
}

function validPropertyType(value: string | null): PropertyType | undefined {
  return propertyTypes.find((candidate) => candidate === value);
}

function validTransactionType(value: string | null): TransactionType | undefined {
  return transactionTypes.find((candidate) => candidate === value);
}
