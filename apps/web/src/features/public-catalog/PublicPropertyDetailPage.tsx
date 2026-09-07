import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import { createPublicPropertyApi } from "./public-property-api.js";
import {
  formatPublicPropertyPrice,
  formatPublicMinorAmount,
  propertyStructuralRoleLabels,
  propertyTypeLabels,
  transactionTypeLabels,
  type PublicPropertyDetail,
  type PublicPropertyCommercialTerms,
} from "./public-property-model.js";
import { PublicCatalogLayout } from "./PublicCatalogLayout.js";
import { Button, LoadingState, StatusBadge, buttonClassName } from "../../ui/index.js";

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
      {state === "loading" ? <LoadingState label="Chargement du bien…" /> : null}
      {state === "not-found" ? (
        <section className="public-detail-state">
          <p className="eyebrow">Catalogue immobilier</p><h1>Bien introuvable</h1>
          <p>Ce bien n’est pas disponible dans ce catalogue.</p><Link className={buttonClassName("primary")} to={backPath}>Retour au catalogue</Link>
        </section>
      ) : null}
      {state === "error" ? (
        <section className="public-detail-state" role="alert">
          <p className="eyebrow">Catalogue immobilier</p><h1>Impossible d’afficher ce bien</h1>
          <p>Veuillez réessayer dans un instant.</p><Button onClick={() => void load()}>Réessayer</Button>
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
          <div className="public-property-badges"><StatusBadge tone="info">{propertyTypeLabels[property.propertyType]}</StatusBadge><StatusBadge>{transactionTypeLabels[property.transactionType]}</StatusBadge></div>
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
        <section><h2>Conditions financières</h2><PublicPricingDetails terms={property.commercialTerms} /></section>
      </div>
    </article>
  );
}

function PublicPricingDetails({ terms }: Readonly<{ terms: PublicPropertyCommercialTerms }>) {
  if (terms.kind === "LONG_TERM_RENTAL") return <dl className="public-details-list">
    <PriceRow label="Loyer mensuel" amount={terms.rentAmountMinor} currency={terms.currency} />
    {terms.securityDepositAmountMinor === undefined ? null : <PriceRow label="Dépôt de garantie" amount={terms.securityDepositAmountMinor} currency={terms.currency} />}
    {terms.chargesAmountMinor === undefined ? null : <PriceRow label="Charges" amount={terms.chargesAmountMinor} currency={terms.currency} />}
    {terms.agencyFeeAmountMinor === undefined ? null : <PriceRow label="Frais d’agence" amount={terms.agencyFeeAmountMinor} currency={terms.currency} />}
  </dl>;
  if (terms.kind === "SHORT_TERM_RENTAL") return <dl className="public-details-list">
    <PriceRow label={`Tarif par ${terms.pricingUnit === "NIGHT" ? "nuit" : "semaine"}`} amount={terms.rateAmountMinor} currency={terms.currency} />
    {terms.cleaningFeeAmountMinor === undefined ? null : <PriceRow label="Frais de ménage" amount={terms.cleaningFeeAmountMinor} currency={terms.currency} />}
    {terms.securityDepositAmountMinor === undefined ? null : <PriceRow label="Dépôt de garantie" amount={terms.securityDepositAmountMinor} currency={terms.currency} />}
    {terms.minimumStayNights === undefined ? null : <div><dt>Durée minimale</dt><dd>{terms.minimumStayNights} nuit{terms.minimumStayNights > 1 ? "s" : ""}</dd></div>}
  </dl>;
  return <dl className="public-details-list">
    <PriceRow label="Prix de vente" amount={terms.salePriceAmountMinor} currency={terms.currency} />
    {terms.agencyFeeAmountMinor === undefined ? null : <PriceRow label="Frais d’agence" amount={terms.agencyFeeAmountMinor} currency={terms.currency} />}
  </dl>;
}

function PriceRow({ label, amount, currency }: Readonly<{ label: string; amount: number; currency: string }>) {
  return <div><dt>{label}</dt><dd>{formatPublicMinorAmount(amount, currency)}</dd></div>;
}

function isCatalogSearch(value: unknown): value is { readonly catalogSearch: string } {
  return typeof value === "object" && value !== null && "catalogSearch" in value && typeof value.catalogSearch === "string";
}
