import { useRef, useState } from "react";

import type { PropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  formatPublicationDate, propertyPhotoCategoryLabels, propertyPhotoRequirements, propertyStatusLabels,
  type Property, type PropertyPhotoStandard,
} from "./property-model.js";
import { PropertyFeedback } from "./PropertyFeedback.js";

export interface PropertyPublicationApi {
  publishProperty: PropertyApi["publishProperty"];
}

export function PropertyPublicationSection({ property, photoStandard, api, onPublished, onReconnect }: Readonly<{
  property: Property;
  photoStandard?: PropertyPhotoStandard;
  api: PropertyPublicationApi;
  onPublished: (property: Property) => void;
  onReconnect?: () => void;
}>) {
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedHere, setPublishedHere] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const inFlight = useRef(false);

  if (property.status === "PUBLISHED") {
    return (
      <section className="content-panel publication-panel" aria-labelledby="property-publication-title">
        <div className="section-heading">
          <div><p className="eyebrow">Cycle de vie</p><h2 id="property-publication-title">Publication</h2></div>
          <span className="quiet-badge">{propertyStatusLabels.PUBLISHED}</span>
        </div>
        {publishedHere && <div className="form-message is-success" role="status"><strong>Le bien est publié.</strong></div>}
        <p>Publié le {formatPublicationDate(property.publishedAt)}.</p>
        <p className="muted-status">La diffusion publique n’est pas incluse dans cette version.</p>
      </section>
    );
  }

  const detailsReady = property.details !== undefined;
  const commercialTermsReady = property.commercialTerms !== undefined;
  const subtypeReady = property.propertyType !== "APARTMENT" || property.transactionType !== "LONG_TERM_RENTAL"
    || property.apartmentSubtype !== undefined;
  const requirements = propertyPhotoRequirements(property, photoStandard);
  const availablePhotos = property.photos ?? [];
  const minimumReady = availablePhotos.length >= requirements.minimumCount;
  const missingViews = requirements.requiredCategories.filter((category) => !availablePhotos.some((photo) => photo.category === category));
  const viewsReady = missingViews.length === 0;
  const primaryPhotoReady = property.primaryPhoto !== undefined || property.photos?.some((photo) => photo.isPrimary) === true;
  const ready = detailsReady && commercialTermsReady && subtypeReady && minimumReady && viewsReady && primaryPhotoReady;

  async function confirmPublication() {
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    setPublishing(true);
    setError(undefined);
    try {
      const published = await api.publishProperty(property.propertyId);
      setPublishedHere(true);
      setConfirmationVisible(false);
      onPublished(published);
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally {
      inFlight.current = false;
      setPublishing(false);
    }
  }

  return (
    <section className="content-panel publication-panel" aria-labelledby="property-publication-title" aria-busy={publishing}>
      <div className="section-heading">
        <div><p className="eyebrow">Cycle de vie</p><h2 id="property-publication-title">Publication</h2></div>
        <span className="quiet-badge">{propertyStatusLabels.DRAFT}</span>
      </div>
      <p>{ready ? "Ce bien est prêt à être publié." : !primaryPhotoReady
        ? "Sélectionnez la photo principale qui représentera ce bien dans les annonces."
        : "Complétez les prérequis avant de publier."}</p>
      <ul className="publication-checklist" aria-label="Préparation à la publication">
        <li className={detailsReady ? "is-ready" : "is-missing"}>Détails {detailsReady ? "renseignés" : "à compléter"}</li>
        <li className={commercialTermsReady ? "is-ready" : "is-missing"}>Conditions commerciales {commercialTermsReady ? "renseignées" : "à compléter"}</li>
        {property.propertyType === "APARTMENT" && property.transactionType === "LONG_TERM_RENTAL" && (
          <li className={subtypeReady ? "is-ready" : "is-missing"}>Sous-type {subtypeReady ? "renseigné" : "à sélectionner"}</li>
        )}
        <li className={minimumReady ? "is-ready" : "is-missing"}>Photos disponibles : {availablePhotos.length}/{requirements.minimumCount} minimum</li>
        {requirements.requiredCategories.map((category) => (
          <li key={category} className={missingViews.includes(category) ? "is-missing" : "is-ready"}>
            Vue « {propertyPhotoCategoryLabels[category]} » {missingViews.includes(category) ? "à ajouter" : "présente"}
          </li>
        ))}
        <li className={primaryPhotoReady ? "is-ready" : "is-missing"}>Photo principale {primaryPhotoReady ? "sélectionnée" : "à sélectionner"}</li>
      </ul>
      {error && <PropertyFeedback error={error} onReconnect={onReconnect} />}
      {!confirmationVisible && (
        <button className="primary-action" type="button" disabled={!ready || publishing} onClick={() => setConfirmationVisible(true)}>
          Publier le bien
        </button>
      )}
      {confirmationVisible && (
        <div className="publication-confirmation" role="alertdialog" aria-labelledby="publication-confirmation-title" aria-describedby="publication-confirmation-description">
          <h3 id="publication-confirmation-title">Confirmer la publication</h3>
          <p id="publication-confirmation-description">Cette première publication est définitive dans cette version. Vous pourrez continuer à modifier le bien, mais pas le dépublier.</p>
          <fieldset disabled={publishing}>
            <button className="primary-action" type="button" onClick={() => void confirmPublication()}>{publishing ? "Publication en cours…" : "Confirmer la publication"}</button>
            <button className="secondary-action" type="button" onClick={() => setConfirmationVisible(false)}>Annuler</button>
          </fieldset>
          {publishing && <p className="muted-status" role="status">Publication en cours…</p>}
        </div>
      )}
    </section>
  );
}
