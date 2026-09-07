import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyDetailsForm } from "./PropertyDetailsForm.js";
import { PropertyPricingForm } from "./PropertyPricingForm.js";
import { PropertyCoreInformationForm } from "./PropertyCoreInformationForm.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  formatMinorAmount, pricingUnitLabels, propertyStatusLabels, propertyStructuralRoleLabels, propertyTypeLabels,
  transactionTypeLabels, type CommercialTerms, type Property, type PropertyPhotoStandard,
} from "./property-model.js";
import { PropertyOwnershipSection } from "./PropertyOwnershipSection.js";
import { PropertyCompositionSection } from "./PropertyCompositionSection.js";
import { PropertyPublicationSection } from "./PropertyPublicationSection.js";
import { PropertyPhotoGallery } from "./PropertyPhotoGallery.js";
import { PropertyGeolocationSection } from "./PropertyGeolocationSection.js";
import { PropertyAvailabilitySection } from "./PropertyAvailabilitySection.js";
import { Alert, LoadingState, PageHeader, StatusBadge, buttonClassName, type BreadcrumbItem, type StatusTone } from "../../ui/index.js";

interface PropertyLocationState {
  readonly created?: boolean;
  readonly compositionContext?: {
    readonly parentPropertyId: string;
    readonly parentTitle: string;
    readonly buildingName?: string;
  };
}

function CommercialTermsSummary({ terms }: Readonly<{ terms: CommercialTerms }>) {
  if (terms.kind === "LONG_TERM_RENTAL") return <>{formatMinorAmount(terms.rentAmountMinor, terms.currency)} / mois</>;
  if (terms.kind === "SHORT_TERM_RENTAL") return <>{formatMinorAmount(terms.rateAmountMinor, terms.currency)} / {pricingUnitLabels[terms.pricingUnit].toLowerCase()}</>;
  return <>{formatMinorAmount(terms.salePriceAmountMinor, terms.currency)}</>;
}

export function PropertyDetailPage() {
  const { propertyId = "" } = useParams();
  const location = useLocation();
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const [property, setProperty] = useState<Property>();
  const [photoStandard, setPhotoStandard] = useState<PropertyPhotoStandard>({ minimumCount: 1, additionalRequiredCategories: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingCoreInformation, setSavingCoreInformation] = useState(false);
  const locationState = location.state as PropertyLocationState | null;
  const [saved, setSaved] = useState(Boolean(locationState?.created));
  const [error, setError] = useState<PropertyUiError>();

  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    void api.retrieveProperty(propertyId).then((value) => { if (active) setProperty(value); })
      .catch((caught: unknown) => { if (active) setError(toPropertyUiError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    void api.retrievePropertyPhotoStandard().then((value) => {
      if (active && Number.isInteger(value.minimumCount) && value.minimumCount >= 1
        && Array.isArray(value.additionalRequiredCategories)) setPhotoStandard(value);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [api, propertyId]);

  async function saveDetails(input: Parameters<typeof api.updatePropertyDetails>[1]) {
    setSaving(true); setSaved(false); setError(undefined);
    try { setProperty(await api.updatePropertyDetails(propertyId, input)); setSaved(true); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  async function saveCoreInformation(input: Parameters<typeof api.updatePropertyCoreInformation>[1]) {
    setSavingCoreInformation(true); setSaved(false); setError(undefined);
    try { setProperty(await api.updatePropertyCoreInformation(propertyId, input)); setSaved(true); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSavingCoreInformation(false); }
  }

  async function savePricing(input: Parameters<typeof api.setPropertyPricing>[1]) {
    setSavingPricing(true); setSaved(false); setError(undefined);
    try { setProperty(await api.setPropertyPricing(propertyId, input)); setSaved(true); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSavingPricing(false); }
  }

  if (loading) return <div className="standalone-state"><LoadingState label="Chargement du bien…" /></div>;
  if (error?.kind === "not-found") return <div className="standalone-state"><p className="error-code">404</p><h1>Bien introuvable</h1><p>{error.message}</p><Link className={buttonClassName("secondary", "inline-action")} to="/properties">Retour aux biens</Link></div>;
  if (!property) return <div className="standalone-state"><PropertyFeedback error={error ?? toPropertyUiError(undefined)} onReconnect={() => void session.login(`/properties/${propertyId}`)} /></div>;

  const breadcrumbs: BreadcrumbItem[] = locationState?.compositionContext === undefined
    ? [{ label: "Biens", to: "/properties" }, { label: property.title }]
    : [
        { label: "Biens", to: "/properties" },
        { label: locationState.compositionContext.parentTitle, to: `/properties/${locationState.compositionContext.parentPropertyId}` },
        ...(locationState.compositionContext.buildingName === undefined ? [] : [{ label: locationState.compositionContext.buildingName }]),
        { label: property.title },
      ];

  return (
    <div className="page-stack property-page">
      <PageHeader
        actions={<Link className={buttonClassName("secondary", "inline-action")} to="/properties">Retour aux biens</Link>}
        breadcrumbs={breadcrumbs}
        eyebrow="Fiche du bien"
        title={property.title}
        meta={<><StatusBadge tone={propertyStatusTone(property.status)}>{propertyStatusLabels[property.status]}</StatusBadge><span className="resource-id">Référence interne : {property.propertyId}</span></>}
      />
      {saved && <Alert title="Enregistré" tone="success"><p>Les informations du bien sont à jour.</p></Alert>}
      {error && <PropertyFeedback error={error} onReconnect={() => void session.login(`/properties/${propertyId}`)} />}

      <nav aria-label="Sections de la fiche" className="property-context-nav">
        <a href="#property-overview">Vue d’ensemble</a>
        <a href="#property-availability">Disponibilité</a>
        <a href="#property-pricing">Tarification</a>
        <a href="#property-publication">Publication</a>
        <a href="#property-photos">Photos</a>
        <a href="#property-information">Informations</a>
        <a href="#property-location">Localisation</a>
        <a href="#property-owners">Propriétaires</a>
        <a href="#property-composition">Composition</a>
      </nav>

      <section className="property-summary content-panel" id="property-overview" aria-labelledby="property-summary-title">
        <div className="section-heading"><div><p className="eyebrow">Vue d’ensemble</p><h2 id="property-summary-title">Informations du bien</h2></div><StatusBadge tone={propertyStatusTone(property.status)}>{propertyStatusLabels[property.status]}</StatusBadge></div>
        <dl className="definition-grid">
          <div><dt>Type</dt><dd>{propertyTypeLabels[property.propertyType]}</dd></div>
          <div><dt>Projet</dt><dd>{transactionTypeLabels[property.transactionType]}</dd></div>
          <div><dt>Rôle structurel</dt><dd>{propertyStructuralRoleLabels[property.structuralRole]}</dd></div>
          <div><dt>Localisation</dt><dd>{property.location.addressLine}, {property.location.district}, {property.location.city} ({property.location.country})</dd></div>
          <div><dt>Description</dt><dd>{property.description ?? "Aucune description"}</dd></div>
          <div><dt>Conditions</dt><dd>{property.commercialTerms ? <CommercialTermsSummary terms={property.commercialTerms} /> : "Non renseignées"}</dd></div>
          <div><dt>Dernière mise à jour</dt><dd>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(property.updatedAt))}</dd></div>
        </dl>
      </section>

      <div id="property-availability"><PropertyAvailabilitySection
        key={`${property.propertyId}:${property.structuralRole}`}
        propertyId={property.propertyId}
        transactionType={property.transactionType}
        api={api}
        onReconnect={() => void session.login(`/properties/${propertyId}`)}
      /></div>

      <section className="content-panel" id="property-pricing" aria-labelledby="property-pricing-title">
        <div className="section-heading"><div><p className="eyebrow">Conditions financières</p><h2 id="property-pricing-title">Tarification du bien</h2></div></div>
        <PropertyPricingForm property={property} saving={savingPricing} onSave={savePricing} />
      </section>

      <div id="property-publication"><PropertyPublicationSection
          property={property}
          photoStandard={photoStandard}
          api={api}
          onPublished={setProperty}
          onWithdrawn={setProperty}
          onReconnect={() => void session.login(`/properties/${propertyId}`)}
        /></div>

      <div id="property-photos"><PropertyPhotoGallery
          property={property}
          api={api}
          onPhotosChanged={(photos) => setProperty((current) => {
            if (current === undefined) return current;
            const primaryPhoto = photos.find((photo) => photo.isPrimary);
            const { primaryPhoto: _previousPrimaryPhoto, ...unchanged } = current;
            return { ...unchanged, photos, ...(primaryPhoto === undefined ? {} : { primaryPhoto }) } as Property;
          })}
          onReconnect={() => void session.login(`/properties/${propertyId}`)}
        /></div>

      <section className="content-panel" id="property-information" aria-labelledby="property-core-information-title">
        <div className="section-heading"><div><p className="eyebrow">Informations fondamentales</p><h2 id="property-core-information-title">Modifier le bien</h2></div></div>
        <PropertyCoreInformationForm property={property} saving={savingCoreInformation} onSave={saveCoreInformation} />
      </section>

      <section className="content-panel" aria-labelledby="property-details-title">
        <div className="section-heading"><div><p className="eyebrow">Description métier</p><h2 id="property-details-title">Caractéristiques du bien</h2></div></div>
        <PropertyDetailsForm property={property} saving={saving} onSave={saveDetails} />
      </section>

      <div id="property-location"><PropertyGeolocationSection
          propertyId={property.propertyId}
          api={api}
          onReconnect={() => void session.login(`/properties/${propertyId}`)}
        /></div>

      <div id="property-owners"><PropertyOwnershipSection propertyId={property.propertyId} api={api} /></div>
      <div id="property-composition"><PropertyCompositionSection property={property} api={api} onStructuralRoleChange={(structuralRole) => setProperty((current) => current === undefined ? current : { ...current, structuralRole })} /></div>
    </div>
  );
}

function propertyStatusTone(status: Property["status"]): StatusTone {
  if (status === "PUBLISHED") return "success";
  if (status === "WITHDRAWN") return "warning";
  return "neutral";
}
