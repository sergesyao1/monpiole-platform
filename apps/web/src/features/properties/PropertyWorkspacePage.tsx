import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  propertyOwnerName, propertyStatusLabels, propertyTypeLabels, propertyTypes, transactionTypeLabels,
  type PropertyOwner, type PropertyPortfolioItem, type PropertyStatus, type PropertyType,
} from "./property-model.js";
import type { PropertyApi } from "./property-api.js";
import { Alert, Button, EmptyState, Field, LoadingState, StatusBadge, buttonClassName, type StatusTone } from "../../ui/index.js";

const PAGE_LIMIT = 20;

interface PortfolioFilters {
  readonly search?: string;
  readonly type?: PropertyType;
  readonly status?: PropertyStatus;
  readonly ownerId?: string;
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
  const [owners, setOwners] = useState<readonly PropertyOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownersError, setOwnersError] = useState<PropertyUiError>();

  useEffect(() => {
    let active = true;
    setOwnersLoading(true);
    setOwnersError(undefined);
    void listAllPropertyOwners(api).then((result) => { if (active) setOwners(result); })
      .catch((error: unknown) => { if (active) setOwnersError(toPropertyUiError(error)); })
      .finally(() => { if (active) setOwnersLoading(false); });
    return () => { active = false; };
  }, [api]);

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
    const ownerId = String(values.get("ownerId") ?? "");
    setFilters({
      ...(search.length === 0 ? {} : { search }),
      ...(type === "" ? {} : { type }),
      ...(status === "" ? {} : { status }),
      ...(ownerId === "" ? {} : { ownerId }),
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
          <Link className={buttonClassName("primary", "inline-action")} to="/properties/new">Créer un bien</Link>
        </div>
        <div className="hero-accent" aria-hidden="true"><span>⌂</span></div>
      </section>

      <section className="content-panel" aria-labelledby="property-portfolio-title" aria-busy={loading || loadingMore}>
        <div className="section-heading">
          <div><p className="eyebrow">Portefeuille privé</p><h2 id="property-portfolio-title">Vos biens</h2></div>
        </div>

        <form className="portfolio-filters" onSubmit={applyFilters} role="search">
          <Field label="Rechercher" optional><input name="search" maxLength={100} defaultValue={filters.search ?? ""} placeholder="Bien, adresse ou propriétaire" /></Field>
          <Field label="Type de bien" optional><select name="type" defaultValue={filters.type ?? ""}><option value="">Tous les types</option>{propertyTypes.map((type) => <option key={type} value={type}>{propertyTypeLabels[type]}</option>)}</select></Field>
          <Field label="Statut" optional><select name="status" defaultValue={filters.status ?? ""}><option value="">Tous les statuts</option><option value="DRAFT">{propertyStatusLabels.DRAFT}</option><option value="PUBLISHED">{propertyStatusLabels.PUBLISHED}</option><option value="WITHDRAWN">{propertyStatusLabels.WITHDRAWN}</option></select></Field>
          <Field label="Propriétaire" optional><select name="ownerId" defaultValue={filters.ownerId ?? ""} disabled={ownersLoading || ownersError !== undefined}><option value="">Tous les propriétaires</option>{owners.map((owner) => <option key={owner.ownerId} value={owner.ownerId}>{propertyOwnerName(owner)}</option>)}</select></Field>
          <Button variant="secondary" type="submit" disabled={loading || loadingMore}>Appliquer les filtres</Button>
        </form>
        {ownersLoading && <p className="muted-status" role="status">Chargement des propriétaires…</p>}
        {ownersError && <Alert tone="warning" title="Filtre propriétaire indisponible"><p>Le portefeuille reste consultable avec les autres filtres.</p></Alert>}

        {loading && <LoadingState label="Chargement de votre portefeuille…" />}
        {!loading && initialError && <PropertyFeedback error={initialError} onReconnect={() => void session.login("/properties")} />}
        {!loading && !initialError && items.length === 0 && (
          <EmptyState
            title="Aucun bien à afficher"
            description="Créez votre premier bien ou modifiez vos critères de recherche."
            action={<Link className={buttonClassName("primary", "inline-action")} to="/properties/new">Créer un bien</Link>}
          />
        )}
        {!loading && !initialError && items.length > 0 && (
          <>
            <ul className="property-portfolio-list">
              {portfolioTree(items).map((node) => <PortfolioNode key={node.propertyId} node={node} />)}
            </ul>
            {nextPageError && <Alert tone="danger" title="La page suivante n’a pas pu être chargée."><p>{nextPageError.message} Les biens déjà affichés restent disponibles.</p></Alert>}
            <div className="portfolio-pagination">
              {hasNextPage && <Button variant="secondary" onClick={() => void loadNextPage()} loading={loadingMore} loadingLabel="Chargement…">Afficher plus de biens</Button>}
              {!hasNextPage && <p className="muted-status" role="status">Tous les biens sont affichés.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

interface PortfolioTreeNode {
  readonly propertyId: string;
  readonly property?: PropertyPortfolioItem;
  readonly title: string;
  readonly children: readonly PortfolioTreeNode[];
}

function portfolioTree(items: readonly PropertyPortfolioItem[]): readonly PortfolioTreeNode[] {
  const nodes = new Map<string, { propertyId: string; property?: PropertyPortfolioItem; title: string; children: PortfolioTreeNode[] }>();
  for (const property of items) nodes.set(property.propertyId, { propertyId: property.propertyId, property, title: property.title, children: [] });
  for (const property of items) {
    if (property.parent && !nodes.has(property.parent.propertyId)) nodes.set(property.parent.propertyId, {
      propertyId: property.parent.propertyId, title: property.parent.title, children: [],
    });
  }
  const roots: PortfolioTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.property?.parent === undefined ? undefined : nodes.get(node.property.parent.propertyId);
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function PortfolioNode({ node }: Readonly<{ node: PortfolioTreeNode }>) {
  return <li className="portfolio-tree-node">
    {node.property ? <PropertyPortfolioCard property={node.property} />
      : <div className="portfolio-parent-context"><strong>{node.title}</strong><Link to={`/properties/${node.propertyId}`}>Consulter la fiche</Link></div>}
    {node.children.length > 0 && <ul className="portfolio-tree-children">{node.children.map((child) => <PortfolioNode key={child.propertyId} node={child} />)}</ul>}
  </li>;
}

function PropertyPortfolioCard({ property }: Readonly<{ property: PropertyPortfolioItem }>) {
  return (
    <article className="property-portfolio-card">
      <FeaturedPhoto property={property} />
      <div className="property-portfolio-card-body">
      <div className="portfolio-card-heading">
        <div><StatusBadge tone={propertyStatusTone(property.status)}>{propertyStatusLabels[property.status]}</StatusBadge><h3>{property.title}</h3></div>
        <span className="property-type-mark" aria-hidden="true">{propertyTypeLabels[property.propertyType].slice(0, 1)}</span>
      </div>
      <p className="portfolio-location">{property.location.district}, {property.location.city} · {property.location.country}</p>
      {property.description && <p className="portfolio-description">{property.description}</p>}
      <dl className="portfolio-metadata">
        <div><dt>Type</dt><dd>{propertyTypeLabels[property.propertyType]}</dd></div>
        <div><dt>Projet</dt><dd>{transactionTypeLabels[property.transactionType]}</dd></div>
      </dl>
      <div className="portfolio-owner">
        <span>Propriétaire</span>
        {property.owner ? <>
          <strong>{property.owner.displayName}{property.owner.additionalOwnerCount > 0 ? ` + ${property.owner.additionalOwnerCount} autre${property.owner.additionalOwnerCount > 1 ? "s" : ""}` : ""}</strong>
          {property.owner.inheritedFrom && <small>Hérité de : {property.owner.inheritedFrom.title}</small>}
          {property.owner.phoneNumber && <a href={`tel:${property.owner.phoneNumber}`}>{property.owner.phoneNumber}</a>}
          {property.owner.email && <a href={`mailto:${property.owner.email}`}>{property.owner.email}</a>}
        </> : <strong>Non renseigné</strong>}
      </div>
      <Link className={buttonClassName("secondary", "inline-action")} to={`/properties/${property.propertyId}`} aria-label={`Consulter ${property.title}`}>Consulter la fiche</Link>
      </div>
    </article>
  );
}

function FeaturedPhoto({ property }: Readonly<{ property: PropertyPortfolioItem }>) {
  const [failed, setFailed] = useState(false);
  const photo = property.featuredPhoto;
  return <div className="portfolio-photo">
    {photo && !failed
      ? <img src={`data:${photo.contentType};base64,${photo.contentBase64}`} alt={`Photo principale — ${property.title}`} onError={() => setFailed(true)} />
      : <div className="portfolio-photo-placeholder" role="img" aria-label={`Aucune photo pour ${property.title}`}><span aria-hidden="true">⌂</span><small>Aucune photo</small></div>}
    {property.photoCount > 0 && <span className="portfolio-photo-count">{property.photoCount} photo{property.photoCount > 1 ? "s" : ""}</span>}
  </div>;
}

function propertyStatusTone(status: PropertyStatus): StatusTone {
  if (status === "PUBLISHED") return "success";
  if (status === "WITHDRAWN") return "warning";
  return "neutral";
}

function appendUnique(current: readonly PropertyPortfolioItem[], next: readonly PropertyPortfolioItem[]): readonly PropertyPortfolioItem[] {
  const knownIds = new Set(current.map((property) => property.propertyId));
  return [...current, ...next.filter((property) => !knownIds.has(property.propertyId))];
}

async function listAllPropertyOwners(api: Pick<PropertyApi, "listPropertyOwners">): Promise<readonly PropertyOwner[]> {
  const owners: PropertyOwner[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.listPropertyOwners({ limit: 100, ...(cursor === undefined ? {} : { cursor }) });
    owners.push(...page.items);
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return owners;
}
