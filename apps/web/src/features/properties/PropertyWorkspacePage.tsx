import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { useSession } from "../../auth/session.js";
import { Alert, Button, EmptyState, Field, LoadingState, StatusBadge, buttonClassName, type StatusTone } from "../../ui/index.js";
import { createPropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import {
  propertyOwnerName,
  propertyStatusLabels,
  propertyTypeLabels,
  propertyTypes,
  transactionTypeLabels,
  type PropertyOwner,
  type PropertyPortfolioItem,
  type PropertyStatus,
  type PropertyType,
} from "./property-model.js";

const PAGE_LIMIT = 20;
const OWNER_SEARCH_LIMIT = 20;

interface PortfolioFilters {
  readonly search?: string;
  readonly type?: PropertyType;
  readonly status?: PropertyStatus;
  readonly ownerId?: string;
}

export function PropertyWorkspacePage() {
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);

  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => portfolioFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  const [items, setItems] = useState<readonly PropertyPortfolioItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [initialError, setInitialError] = useState<PropertyUiError>();
  const [nextPageError, setNextPageError] = useState<PropertyUiError>();

  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState(
    filters.ownerId ?? "",
  );
  const [owners, setOwners] = useState<readonly PropertyOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownersError, setOwnersError] = useState<PropertyUiError>();

  useEffect(() => {
    setSelectedOwnerId(filters.ownerId ?? "");
  }, [filters.ownerId]);

  useEffect(() => {
    if (filters.ownerId === undefined) {
      return;
    }

    let active = true;

    void api.retrievePropertyOwner(filters.ownerId)
      .then((owner) => {
        if (
          !active ||
          owner === undefined ||
          typeof owner.ownerId !== "string"
        ) {
          return;
        }

        setOwners((current) => {
          if (
            current.some(
              (candidate) =>
                candidate.ownerId === owner.ownerId,
            )
          ) {
            return current;
          }

          return [owner, ...current];
        });
      })
      .catch(() => {
        // Le filtre backend reste autoritaire.
        // Une erreur de résolution du libellé ne doit pas
        // empêcher le chargement du portefeuille.
      });

    return () => {
      active = false;
    };
  }, [api, filters.ownerId]);

  useEffect(() => {
    let active = true;

    setOwnersLoading(true);
    setOwnersError(undefined);

    const normalizedSearch = ownerSearch.trim();

    void api.listPropertyOwners({
      limit: OWNER_SEARCH_LIMIT,
      ...(normalizedSearch.length === 0
        ? {}
        : { search: normalizedSearch }),
    }).then((page) => {
      if (!active) return;
      setOwners(page.items);
    }).catch((error: unknown) => {
      if (!active) return;
      setOwners([]);
      setOwnersError(toPropertyUiError(error));
    }).finally(() => {
      if (active) {
        setOwnersLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [api, ownerSearch]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setInitialError(undefined);
    setNextPageError(undefined);

    void api.listProperties({
      limit: PAGE_LIMIT,
      ...filters,
    }).then((page) => {
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
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [api, filters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || loadingMore) return;

    const values = new FormData(event.currentTarget);

    const search = String(values.get("search") ?? "").trim();
    const type = String(values.get("type") ?? "") as PropertyType | "";
    const status = String(values.get("status") ?? "") as PropertyStatus | "";
    const ownerId = selectedOwnerId;

    const next = new URLSearchParams();

    if (search.length > 0) {
      next.set("search", search);
    }

    if (type !== "") {
      next.set("type", type);
    }

    if (status !== "") {
      next.set("status", status);
    }

    if (ownerId !== "") {
      next.set("ownerId", ownerId);
    }

    setSearchParams(next);
  }

  function resetFilters() {
    setOwnerSearch("");
    setSelectedOwnerId("");
    setSearchParams(new URLSearchParams());
  }

  async function loadNextPage() {
    if (
      loadingMore ||
      !hasNextPage ||
      nextCursor === null
    ) {
      return;
    }

    setLoadingMore(true);
    setNextPageError(undefined);

    try {
      const page = await api.listProperties({
        limit: PAGE_LIMIT,
        ...filters,
        cursor: nextCursor,
      });

      setItems((current) => appendUnique(current, page.items));
      setNextCursor(page.pageInfo.nextCursor);
      setHasNextPage(page.pageInfo.hasNextPage);
    } catch (error) {
      setNextPageError(toPropertyUiError(error));
    } finally {
      setLoadingMore(false);
    }
  }

  const filterFormKey = searchParams.toString();

  return (
    <div className="page-stack property-workspace">
      <section className="hero property-hero">
        <div>
          <p className="eyebrow">Biens immobiliers</p>
          <h1>Votre portefeuille immobilier</h1>
          <p className="hero-copy">
            Retrouvez les biens de votre espace, consultez leur fiche et poursuivez leur gestion.
          </p>
          <Link
            className={buttonClassName("primary", "inline-action")}
            to="/properties/new"
          >
            Créer un bien
          </Link>
        </div>

        <div className="hero-accent" aria-hidden="true">
          <span>⌂</span>
        </div>
      </section>

      <section
        className="content-panel"
        aria-labelledby="property-portfolio-title"
        aria-busy={loading || loadingMore}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Portefeuille privé</p>
            <h2 id="property-portfolio-title">Vos biens</h2>
          </div>
        </div>

        <form
          key={filterFormKey}
          className="portfolio-filters"
          onSubmit={applyFilters}
          role="search"
        >
          <Field label="Rechercher" optional>
            <input
              name="search"
              maxLength={100}
              defaultValue={filters.search ?? ""}
              placeholder="Bien, adresse ou propriétaire"
            />
          </Field>

          <Field label="Type de bien" optional>
            <select
              name="type"
              defaultValue={filters.type ?? ""}
            >
              <option value="">Tous les types</option>

              {propertyTypes.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {propertyTypeLabels[type]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Statut" optional>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
            >
              <option value="">Tous les statuts</option>
              <option value="DRAFT">
                {propertyStatusLabels.DRAFT}
              </option>
              <option value="PUBLISHED">
                {propertyStatusLabels.PUBLISHED}
              </option>
              <option value="WITHDRAWN">
                {propertyStatusLabels.WITHDRAWN}
              </option>
            </select>
          </Field>

          <div className="portfolio-owner-filter">
            <Field label="Rechercher un propriétaire" optional>
              <input
                type="search"
                maxLength={100}
                value={ownerSearch}
                placeholder="Nom, raison sociale ou e-mail"
                onChange={(event) => {
                  setOwnerSearch(event.currentTarget.value);
                }}
              />
            </Field>

            <Field label="Propriétaire" optional>
              <select
                name="ownerId"
                value={selectedOwnerId}
                disabled={ownersLoading || ownersError !== undefined}
                onChange={(event) => {
                  setSelectedOwnerId(event.currentTarget.value);
                }}
              >
                <option value="">
                  Tous les propriétaires
                </option>

                {owners.map((owner) => (
                  <option
                    key={owner.ownerId}
                    value={owner.ownerId}
                  >
                    {propertyOwnerName(owner)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="portfolio-filter-actions">
            <Button
              variant="secondary"
              type="submit"
              disabled={loading || loadingMore}
            >
              Appliquer les filtres
            </Button>

            <Button
              variant="secondary"
              type="button"
              disabled={loading || loadingMore}
              onClick={resetFilters}
            >
              Réinitialiser
            </Button>
          </div>
        </form>

        {ownersLoading && (
          <p
            className="muted-status"
            role="status"
          >
            Chargement des propriétaires…
          </p>
        )}

        {ownersError && (
          <Alert
            tone="warning"
            title="Filtre propriétaire indisponible"
          >
            <p>
              Le portefeuille reste consultable avec les autres filtres.
            </p>
          </Alert>
        )}

        {loading && (
          <LoadingState label="Chargement de votre portefeuille…" />
        )}

        {!loading && initialError && (
          <PropertyFeedback
            error={initialError}
            onReconnect={() => void session.login("/properties")}
          />
        )}

        {!loading && !initialError && items.length === 0 && (
          <EmptyState
            title="Aucun bien à afficher"
            description="Créez votre premier bien ou modifiez vos critères de recherche."
            action={(
              <Link
                className={buttonClassName("primary", "inline-action")}
                to="/properties/new"
              >
                Créer un bien
              </Link>
            )}
          />
        )}

        {!loading && !initialError && items.length > 0 && (
          <>
            <ul className="property-portfolio-list">
              {portfolioTree(items).map((node) => (
                <PortfolioNode
                  key={node.propertyId}
                  node={node}
                />
              ))}
            </ul>

            {nextPageError && (
              <Alert
                tone="danger"
                title="La page suivante n’a pas pu être chargée."
              >
                <p>
                  {nextPageError.message} Les biens déjà affichés restent disponibles.
                </p>
              </Alert>
            )}

            <div className="portfolio-pagination">
              {hasNextPage && (
                <Button
                  variant="secondary"
                  onClick={() => void loadNextPage()}
                  loading={loadingMore}
                  loadingLabel="Chargement…"
                >
                  Afficher plus de biens
                </Button>
              )}

              {!hasNextPage && (
                <p
                  className="muted-status"
                  role="status"
                >
                  Tous les biens sont affichés.
                </p>
              )}
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

function portfolioTree(
  items: readonly PropertyPortfolioItem[],
): readonly PortfolioTreeNode[] {
  const nodes = new Map<
    string,
    {
      propertyId: string;
      property?: PropertyPortfolioItem;
      title: string;
      children: PortfolioTreeNode[];
    }
  >();

  for (const property of items) {
    nodes.set(property.propertyId, {
      propertyId: property.propertyId,
      property,
      title: property.title,
      children: [],
    });
  }

  for (const property of items) {
    if (
      property.parent &&
      !nodes.has(property.parent.propertyId)
    ) {
      nodes.set(property.parent.propertyId, {
        propertyId: property.parent.propertyId,
        title: property.parent.title,
        children: [],
      });
    }
  }

  const roots: PortfolioTreeNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.property?.parent === undefined
      ? undefined
      : nodes.get(node.property.parent.propertyId);

    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function PortfolioNode({
  node,
}: Readonly<{ node: PortfolioTreeNode }>) {
  return (
    <li className="portfolio-tree-node">
      {node.property ? (
        <PropertyPortfolioCard property={node.property} />
      ) : (
        <div className="portfolio-parent-context">
          <strong>{node.title}</strong>
          <Link to={`/properties/${node.propertyId}`}>
            Consulter la fiche
          </Link>
        </div>
      )}

      {node.children.length > 0 && (
        <ul className="portfolio-tree-children">
          {node.children.map((child) => (
            <PortfolioNode
              key={child.propertyId}
              node={child}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function PropertyPortfolioCard({
  property,
}: Readonly<{ property: PropertyPortfolioItem }>) {
  return (
    <article className="property-portfolio-card">
      <FeaturedPhoto property={property} />

      <div className="property-portfolio-card-body">
        <div className="portfolio-card-heading">
          <div>
            <StatusBadge tone={propertyStatusTone(property.status)}>
              {propertyStatusLabels[property.status]}
            </StatusBadge>

            <h3>{property.title}</h3>
          </div>

          <span
            className="property-type-mark"
            aria-hidden="true"
          >
            {propertyTypeLabels[property.propertyType].slice(0, 1)}
          </span>
        </div>

        <p className="portfolio-location">
          {property.location.district}, {property.location.city} · {property.location.country}
        </p>

        {property.description && (
          <p className="portfolio-description">
            {property.description}
          </p>
        )}

        <dl className="portfolio-metadata">
          <div>
            <dt>Type</dt>
            <dd>
              {propertyTypeLabels[property.propertyType]}
            </dd>
          </div>

          <div>
            <dt>Projet</dt>
            <dd>
              {transactionTypeLabels[property.transactionType]}
            </dd>
          </div>
        </dl>

        {(property.propertyType === "BUILDING" ||
          property.propertyType === "COMPLEX") &&
          property.contentSummary && (
            <PortfolioContentSummary property={property} />
          )}

        <div className="portfolio-owner">
          <span>Propriétaire</span>

          {property.owner ? (
            <>
              <strong>
                {property.owner.displayName}

                {property.owner.additionalOwnerCount > 0
                  ? ` + ${property.owner.additionalOwnerCount} autre${
                      property.owner.additionalOwnerCount > 1 ? "s" : ""
                    }`
                  : ""}
              </strong>

              {property.owner.inheritedFrom && (
                <small>
                  Hérité de : {property.owner.inheritedFrom.title}
                </small>
              )}

              {property.owner.phoneNumber && (
                <a href={`tel:${property.owner.phoneNumber}`}>
                  {property.owner.phoneNumber}
                </a>
              )}

              {property.owner.email && (
                <a href={`mailto:${property.owner.email}`}>
                  {property.owner.email}
                </a>
              )}
            </>
          ) : (
            <strong>Non renseigné</strong>
          )}
        </div>

        <Link
          className={buttonClassName("secondary", "inline-action")}
          to={`/properties/${property.propertyId}`}
          aria-label={`Consulter ${property.title}`}
        >
          Consulter la fiche
        </Link>
      </div>
    </article>
  );
}

function PortfolioContentSummary({
  property,
}: Readonly<{ property: PropertyPortfolioItem }>) {
  const summary = property.contentSummary;

  if (!summary) return null;

  return (
    <div className="portfolio-content-summary">
      <section aria-label={`Composition de ${property.title}`}>
        <span className="portfolio-summary-title">
          Composition
        </span>

        {summary.buildingCount > 0 && (
          <strong>
            {summary.buildingCount} immeuble
            {summary.buildingCount > 1 ? "s" : ""}
          </strong>
        )}

        {summary.composition.totalUnitCount > 0 && (
          <strong>
            {summary.composition.totalUnitCount} unité
            {summary.composition.totalUnitCount > 1 ? "s" : ""}
          </strong>
        )}

        {summary.composition.unitsByType.length > 0 && (
          <ul>
            {summary.composition.unitsByType.map((entry) => (
              <li key={entry.propertyType}>
                <span>
                  {pluralPropertyTypeLabel(
                    entry.propertyType,
                    entry.totalCount,
                  )}
                </span>

                <strong>{entry.totalCount}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={`Disponibilité de ${property.title}`}>
        <span className="portfolio-summary-title">
          Disponibilité
        </span>

        {summary.availability.byType.length > 0 ? (
          <ul>
            {summary.availability.byType.map((entry) => {
              const unconfiguredCount =
                entry.totalCount - entry.configuredCount;

              return (
                <li key={entry.propertyType}>
                  <span>
                    {pluralPropertyTypeLabel(
                      entry.propertyType,
                      entry.totalCount,
                    )}
                  </span>

                  <strong>
                    {entry.availableCount} disponible
                    {entry.availableCount > 1 ? "s" : ""} /{" "}
                    {entry.totalCount}
                  </strong>

                  {unconfiguredCount > 0 && (
                    <small>
                      {unconfiguredCount} non renseigné
                      {unconfiguredCount > 1 ? "s" : ""}
                    </small>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <span className="muted-text">
            Aucune disponibilité commerciale
          </span>
        )}
      </section>

      <section aria-label={`Contrats de ${property.title}`}>
        <span className="portfolio-summary-title">
          Contrats
        </span>

        <strong>
          {summary.contracts.activeCount} actif
          {summary.contracts.activeCount > 1 ? "s" : ""}
          {" · "}
          {summary.contracts.totalCount} au total
        </strong>
      </section>
    </div>
  );
}

function pluralPropertyTypeLabel(
  propertyType: PropertyPortfolioItem["propertyType"],
  count: number,
): string {
  const singularLabels: Partial<
    Record<PropertyPortfolioItem["propertyType"], string>
  > = {
    APARTMENT: "Appartement",
    HOUSE: "Villa",
    LAND: "Terrain",
    COMMERCIAL: "Local commercial",
    OFFICE: "Bureau",
    SHOP: "Boutique",
    BUILDING: "Immeuble",
    COMPLEX: "Ensemble immobilier",
    OTHER: "Autre",
  };

  const pluralLabels: Partial<
    Record<PropertyPortfolioItem["propertyType"], string>
  > = {
    APARTMENT: "Appartements",
    HOUSE: "Villas",
    LAND: "Terrains",
    COMMERCIAL: "Locaux commerciaux",
    OFFICE: "Bureaux",
    SHOP: "Boutiques",
    BUILDING: "Immeubles",
    COMPLEX: "Ensembles immobiliers",
    OTHER: "Autres",
  };

  return count === 1
    ? (singularLabels[propertyType] ??
        propertyTypeLabels[propertyType])
    : (pluralLabels[propertyType] ??
        propertyTypeLabels[propertyType]);
}

function FeaturedPhoto({
  property,
}: Readonly<{ property: PropertyPortfolioItem }>) {
  const [failed, setFailed] = useState(false);
  const photo = property.featuredPhoto;

  return (
    <div className="portfolio-photo">
      {photo && !failed ? (
        <img
          src={`data:${photo.contentType};base64,${photo.contentBase64}`}
          alt={`Photo principale — ${property.title}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="portfolio-photo-placeholder"
          role="img"
          aria-label={`Aucune photo pour ${property.title}`}
        >
          <span aria-hidden="true">⌂</span>
          <small>Aucune photo</small>
        </div>
      )}

      {property.photoCount > 0 && (
        <span className="portfolio-photo-count">
          {property.photoCount} photo
          {property.photoCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function propertyStatusTone(
  status: PropertyStatus,
): StatusTone {
  if (status === "PUBLISHED") return "success";
  if (status === "WITHDRAWN") return "warning";

  return "neutral";
}

function appendUnique(
  current: readonly PropertyPortfolioItem[],
  next: readonly PropertyPortfolioItem[],
): readonly PropertyPortfolioItem[] {
  const knownIds = new Set(
    current.map((property) => property.propertyId),
  );

  return [
    ...current,
    ...next.filter(
      (property) => !knownIds.has(property.propertyId),
    ),
  ];
}

function portfolioFiltersFromSearchParams(
  params: URLSearchParams,
): PortfolioFilters {
  const search = params.get("search")?.trim();
  const type = validPropertyType(params.get("type"));
  const status = validPropertyStatus(params.get("status"));
  const ownerId = validOwnerId(params.get("ownerId"));

  return {
    ...(search === undefined || search.length === 0
      ? {}
      : { search }),

    ...(type === undefined
      ? {}
      : { type }),

    ...(status === undefined
      ? {}
      : { status }),

    ...(ownerId === undefined
      ? {}
      : { ownerId }),
  };
}

function validPropertyType(
  value: string | null,
): PropertyType | undefined {
  if (value === null) return undefined;

  return propertyTypes.find(
    (candidate) => candidate === value,
  );
}

function validPropertyStatus(
  value: string | null,
): PropertyStatus | undefined {
  if (
    value === "DRAFT" ||
    value === "PUBLISHED" ||
    value === "WITHDRAWN"
  ) {
    return value;
  }

  return undefined;
}

function validOwnerId(
  value: string | null,
): string | undefined {
  if (value === null) return undefined;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  )
    ? value
    : undefined;
}
