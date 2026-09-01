import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  propertyStatusLabels, propertyTypeLabels, propertyTypes, transactionTypeLabels,
  type PropertyPortfolioItem, type PropertyStatus, type PropertyType,
} from "./property-model.js";

const PAGE_LIMIT = 20;

interface PortfolioFilters {
  readonly search?: string;
  readonly type?: PropertyType;
  readonly status?: PropertyStatus;
}

export function PropertyWorkspacePage() {
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const [items, setItems] = useState<readonly PropertyPortfolioItem[]>([]);
  const [filters, setFilters] = useState<PortfolioFilters>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState<PropertyUiError>();
  const [nextPageError, setNextPageError] = useState<PropertyUiError>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setInitialError(undefined);
    setNextPageError(undefined);
    void api.listProperties({ limit: PAGE_LIMIT, ...filters }).then((page) => {
      if (!active) return;
      setItems(page.items);
      setNextCursor(page.pageInfo.nextCursor);
      setHasNextPage(page.pageInfo.hasNextPage);
    }).catch((error: unknown) => {
      if (!active) return;
      setItems([]);
      setNextCursor(null);
      setHasNextPage(false);
      setInitialError(toPropertyUiError(error));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, filters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || loadingMore) return;
    const values = new FormData(event.currentTarget);
    const search = String(values.get("search") ?? "").trim();
    const type = String(values.get("type") ?? "") as PropertyType | "";
    const status = String(values.get("status") ?? "") as PropertyStatus | "";
    setFilters({
      ...(search.length === 0 ? {} : { search }),
      ...(type === "" ? {} : { type }),
      ...(status === "" ? {} : { status }),
    });
  }

  async function loadNextPage() {
    if (loadingMore || !hasNextPage || nextCursor === null) return;
    setLoadingMore(true);
    setNextPageError(undefined);
    try {
      const page = await api.listProperties({ limit: PAGE_LIMIT, ...filters, cursor: nextCursor });
      setItems((current) => appendUnique(current, page.items));
      setNextCursor(page.pageInfo.nextCursor);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (error) {
      setNextPageError(toPropertyUiError(error));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="page-stack property-workspace">
      <section className="hero property-hero">
        <div>
          <p className="eyebrow">Biens immobiliers</p>
          <h1>Votre portefeuille immobilier</h1>
          <p className="hero-copy">Retrouvez les biens de votre espace, consultez leur fiche et poursuivez leur gestion.</p>
          <Link className="primary-action inline-action" to="/properties/new">Créer un bien</Link>
        </div>
        <div className="hero-accent" aria-hidden="true"><span>⌂</span></div>
      </section>

      <section className="content-panel" aria-labelledby="property-portfolio-title" aria-busy={loading || loadingMore}>
        <div className="section-heading">
          <div><p className="eyebrow">Portefeuille privé</p><h2 id="property-portfolio-title">Vos biens</h2></div>
        </div>

        <form className="portfolio-filters" onSubmit={applyFilters} role="search">
          <label>Rechercher<input name="search" maxLength={100} defaultValue={filters.search ?? ""} placeholder="Titre, ville, quartier ou adresse" /></label>
          <label>Type de bien<select name="type" defaultValue={filters.type ?? ""}><option value="">Tous les types</option>{propertyTypes.map((type) => <option key={type} value={type}>{propertyTypeLabels[type]}</option>)}</select></label>
          <label>Statut<select name="status" defaultValue={filters.status ?? ""}><option value="">Tous les statuts</option><option value="DRAFT">{propertyStatusLabels.DRAFT}</option><option value="PUBLISHED">{propertyStatusLabels.PUBLISHED}</option><option value="WITHDRAWN">{propertyStatusLabels.WITHDRAWN}</option></select></label>
          <button className="secondary-action" type="submit" disabled={loading || loadingMore}>Appliquer les filtres</button>
        </form>

        {loading && <div className="portfolio-state" role="status"><span className="loading-indicator" aria-hidden="true" /><p>Chargement de votre portefeuille…</p></div>}
        {!loading && initialError && <PropertyFeedback error={initialError} onReconnect={() => void session.login("/properties")} />}
        {!loading && !initialError && items.length === 0 && (
          <div className="portfolio-state portfolio-empty">
            <h3>Aucun bien à afficher</h3>
            <p>Créez votre premier bien ou modifiez vos critères de recherche.</p>
            <Link className="primary-action inline-action" to="/properties/new">Créer un bien</Link>
          </div>
        )}
        {!loading && !initialError && items.length > 0 && (
          <>
            <ul className="property-portfolio-list">
              {items.map((property) => <PropertyPortfolioCard key={property.propertyId} property={property} />)}
            </ul>
            {nextPageError && <div className="form-message" role="alert"><strong>La page suivante n’a pas pu être chargée.</strong><p>{nextPageError.message} Les biens déjà affichés restent disponibles.</p></div>}
            <div className="portfolio-pagination">
              {hasNextPage && <button className="secondary-action" type="button" onClick={() => void loadNextPage()} disabled={loadingMore}>{loadingMore ? "Chargement…" : "Afficher plus de biens"}</button>}
              {!hasNextPage && <p className="muted-status" role="status">Tous les biens disponibles sont affichés.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PropertyPortfolioCard({ property }: Readonly<{ property: PropertyPortfolioItem }>) {
  return (
    <li className="property-portfolio-card">
      <div className="portfolio-card-heading">
        <div><span className="quiet-badge">{propertyStatusLabels[property.status]}</span><h3>{property.title}</h3></div>
        <span className="property-type-mark" aria-hidden="true">{propertyTypeLabels[property.propertyType].slice(0, 1)}</span>
      </div>
      <p className="portfolio-location">{property.location.district}, {property.location.city} · {property.location.country}</p>
      {property.description && <p className="portfolio-description">{property.description}</p>}
      <dl className="portfolio-metadata">
        <div><dt>Type</dt><dd>{propertyTypeLabels[property.propertyType]}</dd></div>
        <div><dt>Projet</dt><dd>{transactionTypeLabels[property.transactionType]}</dd></div>
      </dl>
      <Link className="secondary-action inline-action" to={`/properties/${property.propertyId}`} aria-label={`Consulter ${property.title}`}>Consulter la fiche</Link>
    </li>
  );
}

function appendUnique(current: readonly PropertyPortfolioItem[], next: readonly PropertyPortfolioItem[]): readonly PropertyPortfolioItem[] {
  const knownIds = new Set(current.map((property) => property.propertyId));
  return [...current, ...next.filter((property) => !knownIds.has(property.propertyId))];
}
