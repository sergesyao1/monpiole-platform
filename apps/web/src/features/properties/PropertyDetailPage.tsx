import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { PropertyDetailsForm } from "./PropertyDetailsForm.js";
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
  const [savingCoreInformation, setSavingCoreInformation] = useState(false);
  const [saved, setSaved] = useState(Boolean((location.state as { created?: boolean } | null)?.created));
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

  if (loading) return <div className="standalone-state"><div className="loading-indicator" aria-hidden="true" /><p role="status">Chargement du bien…</p></div>;
  if (error?.kind === "not-found") return <div className="standalone-state"><p className="error-code">404</p><h1>Bien introuvable</h1><p>{error.message}</p><Link className="secondary-action inline-action" to="/properties">Retour aux biens</Link></div>;
  if (!property) return <div className="standalone-state"><PropertyFeedback error={error ?? toPropertyUiError(undefined)} onReconnect={() => void session.login(`/properties/${propertyId}`)} /></div>;

  return (
    <div className="page-stack property-page">
      <div className="page-heading">
        <div><p className="eyebrow">Fiche du bien</p><h1>{property.title}</h1><p className="resource-id">{property.propertyId}</p></div>
        <Link className="secondary-action inline-action" to="/properties">Retour aux biens</Link>
      </div>
      {saved && <div className="form-message is-success" role="status"><strong>Enregistré</strong><p>Les informations du bien sont à jour.</p></div>}
      {error && <PropertyFeedback error={error} onReconnect={() => void session.login(`/properties/${propertyId}`)} />}

      <section className="property-summary content-panel" aria-labelledby="property-summary-title">
        <div className="section-heading"><div><p className="eyebrow">Vue d’ensemble</p><h2 id="property-summary-title">Informations du bien</h2></div><span className="quiet-badge">{propertyStatusLabels[property.status]}</span></div>
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

      <PropertyPublicationSection
        property={property}
        photoStandard={photoStandard}
        api={api}
        onPublished={setProperty}
        onReconnect={() => void session.login(`/properties/${propertyId}`)}
      />

      <PropertyPhotoGallery
        property={property}
        api={api}
        onPhotosChanged={(photos) => setProperty((current) => {
          if (current === undefined) return current;
          const primaryPhoto = photos.find((photo) => photo.isPrimary);
          const { primaryPhoto: _previousPrimaryPhoto, ...unchanged } = current;
          return { ...unchanged, photos, ...(primaryPhoto === undefined ? {} : { primaryPhoto }) } as Property;
        })}
        onReconnect={() => void session.login(`/properties/${propertyId}`)}
      />

      <PropertyGeolocationSection
        propertyId={property.propertyId}
        api={api}
        onReconnect={() => void session.login(`/properties/${propertyId}`)}
      />

      <section className="content-panel" aria-labelledby="property-core-information-title">
        <div className="section-heading"><div><p className="eyebrow">Informations fondamentales</p><h2 id="property-core-information-title">Modifier le bien</h2></div></div>
        <PropertyCoreInformationForm property={property} saving={savingCoreInformation} onSave={saveCoreInformation} />
      </section>

      <section className="content-panel" aria-labelledby="property-details-title">
        <div className="section-heading"><div><p className="eyebrow">Description métier</p><h2 id="property-details-title">Détails et conditions commerciales</h2></div></div>
        <PropertyDetailsForm property={property} saving={saving} onSave={saveDetails} />
      </section>

      <PropertyOwnershipSection propertyId={property.propertyId} api={api} />
      <PropertyCompositionSection property={property} api={api} onStructuralRoleChange={(structuralRole) => setProperty((current) => current === undefined ? current : { ...current, structuralRole })} />
    </div>
  );
}
