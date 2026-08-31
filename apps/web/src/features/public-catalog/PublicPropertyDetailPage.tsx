import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import { createPublicPropertyApi } from "./public-property-api.js";
import {
  formatPublicPropertyPrice,
  propertyStructuralRoleLabels,
  propertyTypeLabels,
  transactionTypeLabels,
  type PublicPropertyDetail,
} from "./public-property-model.js";
import { PublicCatalogLayout } from "./PublicCatalogLayout.js";

const api = createPublicPropertyApi();

export function PublicPropertyDetailPage() {
  const { publicPropertyId = "" } = useParams();
  const location = useLocation();
  const [property, setProperty] = useState<PublicPropertyDetail>();
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const catalogSearch = isCatalogSearch(location.state) ? location.state.catalogSearch : "";
  const backPath = catalogSearch.length === 0 ? "/catalogue" : `/catalogue?${catalogSearch}`;

  async function load() {
    setState("loading");
    try {
      setProperty(await api.retrieve(publicPropertyId));
      setState("ready");
    } catch (error) {
      setState(error instanceof ApiProblem && error.problem.status === 404 ? "not-found" : "error");
    }
  }

  useEffect(() => { void load(); }, [publicPropertyId]);

  return (
    <PublicCatalogLayout>
      {state === "loading" ? <div className="public-catalog-state" role="status"><span className="loading-indicator" aria-hidden="true" />Chargement du bien…</div> : null}
      {state === "not-found" ? (
        <section className="public-detail-state">
          <p className="eyebrow">Catalogue immobilier</p><h1>Bien introuvable</h1>
          <p>Ce bien n’est pas disponible dans ce catalogue.</p><Link className="primary-action" to={backPath}>Retour au catalogue</Link>
        </section>
      ) : null}
      {state === "error" ? (
        <section className="public-detail-state" role="alert">
          <p className="eyebrow">Catalogue immobilier</p><h1>Impossible d’afficher ce bien</h1>
          <p>Veuillez réessayer dans un instant.</p><button className="primary-action" type="button" onClick={() => void load()}>Réessayer</button>
        </section>
      ) : null}
      {state === "ready" && property !== undefined ? <PublicPropertyDetailView property={property} backPath={backPath} /> : null}
    </PublicCatalogLayout>
  );
}

function PublicPropertyDetailView({ property, backPath }: Readonly<{ property: PublicPropertyDetail; backPath: string }>) {
  return (
    <article className="public-detail">
      <Link className="public-back-link" to={backPath}>← Retour au catalogue</Link>
      <div className="public-detail-grid">
        <div className="public-detail-photo">
          {property.primaryPhoto === null
            ? <div className="public-photo-placeholder" role="img" aria-label={`Aucune photo disponible pour ${property.title}`}><span aria-hidden="true">⌂</span></div>
            : <img src={api.photoUrl(property.primaryPhoto.url)} alt={`Photo principale de ${property.title}`} />}
        </div>
        <div className="public-detail-copy">
          <div className="public-property-badges"><span>{propertyTypeLabels[property.propertyType]}</span><span>{transactionTypeLabels[property.transactionType]}</span></div>
          <h1>{property.title}</h1>
          <p className="public-property-location">{property.location.city} · {property.location.district} · {property.location.country}</p>
          <p className="public-detail-price">{formatPublicPropertyPrice(property.commercialTerms)}</p>
          <p className="public-property-role">{propertyStructuralRoleLabels[property.structuralRole]}</p>
        </div>
      </div>
      <div className="public-detail-sections">
        <section><h2>À propos de ce bien</h2><p>{property.description ?? "Aucune description complémentaire n’est disponible."}</p></section>
        <section><h2>Caractéristiques</h2><dl className="public-details-list">
          {property.details.usableSurfaceSquareMeters !== undefined ? <div><dt>Surface utile</dt><dd>{property.details.usableSurfaceSquareMeters} m²</dd></div> : null}
          {property.details.rooms !== undefined ? <div><dt>Pièces</dt><dd>{property.details.rooms}</dd></div> : null}
          {property.details.bedrooms !== undefined ? <div><dt>Chambres</dt><dd>{property.details.bedrooms}</dd></div> : null}
          {property.details.bathrooms !== undefined ? <div><dt>Salles d’eau</dt><dd>{property.details.bathrooms}</dd></div> : null}
          {property.details.furnished !== undefined ? <div><dt>Meublé</dt><dd>{property.details.furnished ? "Oui" : "Non"}</dd></div> : null}
        </dl></section>
      </div>
    </article>
  );
}

function isCatalogSearch(value: unknown): value is { readonly catalogSearch: string } {
  return typeof value === "object" && value !== null && "catalogSearch" in value && typeof value.catalogSearch === "string";
}
