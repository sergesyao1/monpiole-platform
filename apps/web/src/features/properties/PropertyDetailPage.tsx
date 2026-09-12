import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyDetailsForm } from "./PropertyDetailsForm.js";
import { PropertyPricingForm } from "./PropertyPricingForm.js";
import { PropertyCoreInformationForm } from "./PropertyCoreInformationForm.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  formatMinorAmount, pricingUnitLabels, propertyStatusLabels, propertyTypeLabels,
  transactionTypeLabels, type CommercialTerms, type Property, type PropertyWorkspace,
} from "./property-model.js";
import { PropertyOwnershipSection } from "./PropertyOwnershipSection.js";
import { PropertyCompositionSection } from "./PropertyCompositionSection.js";
import { PropertyPublicationSection } from "./PropertyPublicationSection.js";
import { PropertyPhotoGallery } from "./PropertyPhotoGallery.js";
import { PropertyGeolocationSection } from "./PropertyGeolocationSection.js";
import { PropertyAvailabilitySection } from "./PropertyAvailabilitySection.js";
import { PropertyContractsSection } from "./PropertyContractsSection.js";
import { PropertyAmenitiesSection } from "./PropertyAmenitiesSection.js";
import { PropertyInquiriesSection } from "./PropertyInquiriesSection.js";
import { PropertyApplicationsSection } from "./PropertyApplicationsSection.js";
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
  const [workspace, setWorkspace] = useState<PropertyWorkspace>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingCoreInformation, setSavingCoreInformation] = useState(false);
  const locationState = location.state as PropertyLocationState | null;
  const activeSection = location.hash.length === 0 ? "#property-overview" : location.hash;
  const [saved, setSaved] = useState(Boolean(locationState?.created));
  const [error, setError] = useState<PropertyUiError>();

  const loadWorkspace = useCallback(async () => {
    const value = await api.retrievePropertyWorkspace(propertyId);
    setWorkspace(value);
    setProperty(value.property);
  }, [api, propertyId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    void api.retrievePropertyWorkspace(propertyId).then((value) => {
      if (active) { setWorkspace(value); setProperty(value.property); }
    })
      .catch((caught: unknown) => { if (active) setError(toPropertyUiError(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, propertyId]);

  useEffect(() => {
    if (loading || !workspace || location.hash.length === 0) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView?.({ block: "start" });
  }, [loading, location.hash, workspace]);

  async function saveDetails(input: Parameters<typeof api.updatePropertyDetails>[1]) {
    setSaving(true); setSaved(false); setError(undefined);
    try { const updated = await api.updatePropertyDetails(propertyId, input); await loadWorkspace(); setProperty(updated); setSaved(true); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  async function saveCoreInformation(input: Parameters<typeof api.updatePropertyCoreInformation>[1]) {
    setSavingCoreInformation(true); setSaved(false); setError(undefined);
    try { const updated = await api.updatePropertyCoreInformation(propertyId, input); await loadWorkspace(); setProperty(updated); setSaved(true); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSavingCoreInformation(false); }
  }

  async function savePricing(input: Parameters<typeof api.setPropertyPricing>[1]) {
    setSavingPricing(true); setSaved(false); setError(undefined);
    try { const updated = await api.setPropertyPricing(propertyId, input); await loadWorkspace(); setProperty(updated); setSaved(true); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSavingPricing(false); }
  }

  if (loading) return <div className="standalone-state"><LoadingState label="Chargement du bien…" /></div>;
  if (error?.kind === "not-found") return <div className="standalone-state"><p className="error-code">404</p><h1>Bien introuvable</h1><p>{error.message}</p><Link className={buttonClassName("secondary", "inline-action")} to="/properties">Retour aux biens</Link></div>;
  if (!property || !workspace) return <div className="standalone-state"><PropertyFeedback error={error ?? toPropertyUiError(undefined)} onReconnect={() => void session.login(`/properties/${propertyId}`)} /></div>;

  const breadcrumbs: BreadcrumbItem[] = locationState?.compositionContext === undefined
    ? [{ label: "Biens", to: "/properties" }, { label: property.title }]
    : [
        { label: "Biens", to: "/properties" },
        { label: locationState.compositionContext.parentTitle, to: `/properties/${locationState.compositionContext.parentPropertyId}` },
        ...(locationState.compositionContext.buildingName === undefined ? [] : [{ label: locationState.compositionContext.buildingName }]),
        { label: property.title },
      ];
  const leaseEligible = workspace.leaseEligibility.eligible;
  const leaseReason = workspace.leaseEligibility.eligible ? "" : workspace.leaseEligibility.reasonCode === "NOT_LONG_TERM_RENTAL"
    ? "Les contrats de bail sont réservés aux biens proposés en location longue durée."
    : "Ce bien ne constitue pas une cible de bail admissible. Vérifiez sa composition et son rattachement.";

  return (
    <div className="page-stack property-page">
      <PageHeader
        actions={<>{leaseEligible ? <a className={buttonClassName("primary", "inline-action")} href="#property-contracts">Gérer les contrats</a> : <button className={buttonClassName("primary", "inline-action")} disabled title={leaseReason}>Gérer les contrats</button>}<Link className={buttonClassName("secondary", "inline-action")} to="/properties">Retour aux biens</Link></>}
        breadcrumbs={breadcrumbs}
        eyebrow="Fiche du bien"
        title={property.title}
        meta={<>
          <span>{propertyTypeLabels[property.propertyType]}</span>
          <StatusBadge tone={propertyStatusTone(property.status)}>{propertyStatusLabels[property.status]}</StatusBadge>
          <span>{availabilitySummary(workspace.availability)} · {occupancySummary(workspace.availability)}</span>
          {property.commercialTerms && <span><CommercialTermsSummary terms={property.commercialTerms} /></span>}
          <span className="resource-id">Référence interne : {property.propertyId}</span>
        </>}
      />
      {saved && <Alert title="Enregistré" tone="success"><p>Les informations du bien sont à jour.</p></Alert>}
      {error && <PropertyFeedback error={error} onReconnect={() => void session.login(`/properties/${propertyId}`)} />}

      <nav aria-label="Sections de la fiche" className="property-context-nav">
        <a aria-current={activeSection === "#property-overview" ? "location" : undefined} href="#property-overview">Vue d’ensemble</a>
        <a aria-current={activeSection === "#property-inquiries" ? "location" : undefined} href="#property-inquiries">Demandes</a>
        <a aria-current={activeSection === "#property-applications" ? "location" : undefined} href="#property-applications">Candidatures</a>
        {leaseEligible ? <a aria-current={activeSection === "#property-contracts" ? "location" : undefined} href="#property-contracts">Clients et contrats</a> : <span aria-disabled="true" title={leaseReason}>Clients et contrats</span>}
        <a aria-current={activeSection === "#property-availability" ? "location" : undefined} href="#property-availability">Disponibilité</a>
        <a aria-current={activeSection === "#property-pricing" ? "location" : undefined} href="#property-pricing">Tarification</a>
        <a aria-current={activeSection === "#property-publication" ? "location" : undefined} href="#property-publication">Publication</a>
        <a aria-current={activeSection === "#property-photos" ? "location" : undefined} href="#property-photos">Photos</a>
        <a aria-current={activeSection === "#property-information" ? "location" : undefined} href="#property-information">Informations</a>
        <a aria-current={activeSection === "#property-location" ? "location" : undefined} href="#property-location">Localisation</a>
        <a aria-current={activeSection === "#property-amenities" ? "location" : undefined} href="#property-amenities">Équipements</a>
        <a aria-current={activeSection === "#property-owners" ? "location" : undefined} href="#property-owners">Propriétaires</a>
        <a aria-current={activeSection === "#property-composition" ? "location" : undefined} href="#property-composition">Composition</a>
      </nav>

      <section className="property-summary content-panel" id="property-overview" aria-labelledby="property-summary-title">
        <div className="section-heading"><div><p className="eyebrow">Vue d’ensemble</p><h2 id="property-summary-title">Informations du bien</h2></div><StatusBadge tone={propertyStatusTone(property.status)}>{propertyStatusLabels[property.status]}</StatusBadge></div>
        <dl className="definition-grid">
          <div><dt>Type</dt><dd>{propertyTypeLabels[property.propertyType]}</dd></div>
          <div><dt>Projet</dt><dd>{transactionTypeLabels[property.transactionType]}</dd></div>
          <div><dt>Organisation</dt><dd>{property.propertyType === "BUILDING" ? "Immeuble" : property.propertyType === "COMPLEX" ? "Résidence"
            : property.structuralRole === "UNIT" ? "Unité d’immeuble" : workspace.composition.parentComplex ? "Bien de la résidence" : "Bien indépendant"}</dd></div>
          <div><dt>Localisation</dt><dd>{property.location.addressLine}, {property.location.district}, {property.location.city} ({property.location.country})</dd></div>
          <div><dt>Description</dt><dd>{property.description ?? "Aucune description"}</dd></div>
          <div><dt>Conditions</dt><dd>{property.commercialTerms ? <CommercialTermsSummary terms={property.commercialTerms} /> : "Non renseignées"}</dd></div>
          <div><dt>Dernière mise à jour</dt><dd>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(property.updatedAt))}</dd></div>
        </dl>
        <div className="workspace-summary-grid" aria-label="Synthèse opérationnelle">
          <a href="#property-availability"><strong>{availabilitySummary(workspace.availability)}</strong><span>Disponibilité</span></a>
          <a href="#property-publication"><strong>{workspace.publicationReadiness.ready ? "Prêt" : `${workspace.publicationReadiness.missingRequirements.length} à compléter`}</strong><span>Publication</span></a>
          {leaseEligible ? <a href="#property-contracts"><strong>{workspace.contracts.activeCount} actif{workspace.contracts.activeCount > 1 ? "s" : ""}</strong><span>{workspace.contracts.totalCount} contrat{workspace.contracts.totalCount > 1 ? "s" : ""}</span></a> : <div title={leaseReason}><strong>Indisponible</strong><span>Contrats</span></div>}
          <a href="#property-owners"><strong>{workspace.owners.length}</strong><span>Propriétaire{workspace.owners.length > 1 ? "s" : ""}</span></a>
          <a href="#property-composition">{property.propertyType === "BUILDING"
            ? <><strong>{workspace.composition.unitCount} unité{workspace.composition.unitCount > 1 ? "s" : ""}</strong><span>Composition de l’immeuble</span></>
            : property.propertyType === "COMPLEX"
              ? <><strong>{workspace.composition.buildingCount} immeuble{workspace.composition.buildingCount > 1 ? "s" : ""}</strong><span>{workspace.composition.directChildCount ?? 0} bien{(workspace.composition.directChildCount ?? 0) > 1 ? "s" : ""} direct{(workspace.composition.directChildCount ?? 0) > 1 ? "s" : ""}</span></>
            : property.structuralRole === "COMPOSITE"
            ? <><strong>{workspace.composition.buildingCount} immeuble{workspace.composition.buildingCount > 1 ? "s" : ""}</strong><span>{workspace.composition.unitCount} unité{workspace.composition.unitCount > 1 ? "s" : ""}</span></>
            : property.structuralRole === "UNIT"
              ? <><strong>Unité</strong><span>{workspace.composition.parentBuilding?.buildingName ?? "Rattachement non disponible"}</span></>
              : workspace.composition.parentComplex
                ? <><strong>Résidence</strong><span>{workspace.composition.parentComplex.title}</span></>
              : <><strong>Bien indépendant</strong><span>Composition</span></>}</a>
        </div>
      </section>

      <div id="property-contracts">{leaseEligible ? <PropertyContractsSection
        propertyId={property.propertyId}
        api={api}
        canView={workspace.capabilities.canViewContracts}
        canCreate={workspace.capabilities.canCreateContract}
        creationBlocked={workspace.leaseEligibility.eligible && workspace.leaseEligibility.blockedByActiveLease}
        onChanged={loadWorkspace}
        onReconnect={() => void session.login(`/properties/${propertyId}`)}
      /> : <section className="content-panel" aria-labelledby="property-contracts-unavailable"><h2 id="property-contracts-unavailable">Contrats indisponibles</h2><p>{leaseReason}</p></section>}</div>

      <div id="property-availability"><PropertyAvailabilitySection
        key={`${property.propertyId}:${property.structuralRole}`}
        propertyId={property.propertyId}
        transactionType={property.transactionType}
        api={api}
        initialAvailability={workspace.availability}
        onReconnect={() => void session.login(`/properties/${propertyId}`)}
      /></div>

      <section className="content-panel" id="property-pricing" aria-labelledby="property-pricing-title">
        <div className="section-heading"><div><p className="eyebrow">Conditions financières</p><h2 id="property-pricing-title">Tarification du bien</h2></div></div>
        {property.propertyType === "COMPLEX" ? <p>La résidence organise des biens qui disposent chacun de leur propre tarification.</p>
          : property.propertyType === "BUILDING" && property.commercializationMode === "INDIVIDUAL_UNITS"
            ? <p>Les unités de cet immeuble disposent chacune de leur propre tarification.</p>
            : property.structuralRole === "UNIT" && workspace.composition.parentBuilding?.parentBuildingCommercializationMode === "WHOLE_BUILDING"
              ? <p>Cet immeuble est commercialisé en entier ; sa tarification est gérée sur la fiche de l’immeuble.</p>
              : <PropertyPricingForm property={property} saving={savingPricing} onSave={savePricing} />}
      </section>

      <div id="property-publication"><PropertyPublicationSection
          property={property}
          publicationReadiness={workspace.publicationReadiness}
          api={api}
          onPublished={setProperty}
          onWithdrawn={setProperty}
          onReconnect={() => void session.login(`/properties/${propertyId}`)}
        /></div>

      <div id="property-photos"><PropertyPhotoGallery
          property={property}
          api={api}
          onPhotosChanged={(photos) => {
            setProperty((current) => {
              if (current === undefined) return current;
              const primaryPhoto = photos.find((photo) => photo.isPrimary);
              const { primaryPhoto: _previousPrimaryPhoto, ...unchanged } = current;
              return { ...unchanged, photos, ...(primaryPhoto === undefined ? {} : { primaryPhoto }) } as Property;
            });
            void loadWorkspace();
          }}
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
      <PropertyAmenitiesSection propertyId={property.propertyId} api={api} onReconnect={() => void session.login(`/properties/${propertyId}`)} />
      <PropertyInquiriesSection propertyId={property.propertyId} api={api}/>
      <PropertyApplicationsSection propertyId={property.propertyId} api={api}/>

      <div id="property-owners"><PropertyOwnershipSection propertyId={property.propertyId} api={api} initialOwners={workspace.owners} canManage={workspace.capabilities.canManageOwners} onChanged={loadWorkspace} /></div>
      <div id="property-composition"><PropertyCompositionSection property={property} api={api} parentBuilding={workspace.composition.parentBuilding} parentComplex={workspace.composition.parentComplex} onChanged={loadWorkspace} /></div>
    </div>
  );
}

function availabilitySummary(availability: PropertyWorkspace["availability"]): string {
  if (availability.source === "DERIVED_FROM_UNITS") {
    if (availability.availabilityStatus === "AVAILABLE") return "Disponible";
    if (availability.availabilityStatus === "UNAVAILABLE") return "Indisponible";
    return "À renseigner";
  }
  if (!availability.configured) return "À renseigner";
  return availability.availabilityStatus === "AVAILABLE" ? "Disponible" : "Indisponible";
}

function occupancySummary(availability: PropertyWorkspace["availability"]): string {
  if (availability.source === "DERIVED_FROM_UNITS") {
    return availability.totalUnitCount === 0
      ? "Occupation à renseigner"
      : `${availability.occupiedUnitCount}/${availability.totalUnitCount} occupée${availability.occupiedUnitCount > 1 ? "s" : ""}`;
  }
  if (!availability.configured) return "Occupation à renseigner";
  return availability.occupancyStatus === "OCCUPIED" ? "Occupé" : "Vacant";
}

function propertyStatusTone(status: Property["status"]): StatusTone {
  if (status === "PUBLISHED") return "success";
  if (status === "WITHDRAWN") return "warning";
  return "neutral";
}
