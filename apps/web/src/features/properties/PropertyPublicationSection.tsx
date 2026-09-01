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
  withdrawPropertyFromCatalog: PropertyApi["withdrawPropertyFromCatalog"];
}

export function PropertyPublicationSection({ property, photoStandard, api, onPublished, onWithdrawn, onReconnect }: Readonly<{
  property: Property;
  photoStandard?: PropertyPhotoStandard;
  api: PropertyPublicationApi;
  onPublished: (property: Property) => void;
  onWithdrawn: (property: Property) => void;
  onReconnect?: () => void;
}>) {
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedHere, setPublishedHere] = useState(false);
  const [withdrawalConfirmationVisible, setWithdrawalConfirmationVisible] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawnHere, setWithdrawnHere] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const inFlight = useRef(false);

  async function confirmWithdrawal() {
    if (inFlight.current || property.status !== "PUBLISHED" || !property.canWithdrawFromCatalog) return;
    inFlight.current = true;
    setWithdrawing(true);
    setError(undefined);
    try {
      const withdrawn = await api.withdrawPropertyFromCatalog(property.propertyId);
      setWithdrawnHere(true);
      setWithdrawalConfirmationVisible(false);
      onWithdrawn(withdrawn);
    } catch (caught) {
      setError(toPropertyUiError(caught));
    } finally {
      inFlight.current = false;
      setWithdrawing(false);
    }
  }

  if (property.status === "WITHDRAWN") {
    return (
      <section className="content-panel publication-panel" aria-labelledby="property-publication-title">
        <div className="section-heading">
          <div><p className="eyebrow">Cycle de vie</p><h2 id="property-publication-title">Publication</h2></div>
          <span className="quiet-badge">{propertyStatusLabels.WITHDRAWN}</span>
        </div>
        {withdrawnHere && <div className="form-message is-success" role="status"><strong>Le bien a été retiré du catalogue.</strong></div>}
        <p>Publié le {formatPublicationDate(property.publishedAt)}.</p>
        <p>Retiré le {formatPublicationDate(property.withdrawnAt)}.</p>
        <p className="muted-status">Ce bien n’est plus visible publiquement et reste disponible dans votre portefeuille.</p>
      </section>
    );
  }

  if (property.status === "PUBLISHED") {
    return (
      <section className="content-panel publication-panel" aria-labelledby="property-publication-title" aria-busy={withdrawing}>
        <div className="section-heading">
          <div><p className="eyebrow">Cycle de vie</p><h2 id="property-publication-title">Publication</h2></div>
          <span className="quiet-badge">{propertyStatusLabels.PUBLISHED}</span>
        </div>
        {publishedHere && <div className="form-message is-success" role="status"><strong>Le bien est publié.</strong></div>}
        <p>Publié le {formatPublicationDate(property.publishedAt)}.</p>
        <p className="muted-status">Ce bien est visible dans le catalogue public.</p>
        {error && <PropertyFeedback error={error} onReconnect={onReconnect} />}
        {property.canWithdrawFromCatalog && !withdrawalConfirmationVisible && (
          <button className="secondary-action" type="button" disabled={withdrawing} onClick={() => setWithdrawalConfirmationVisible(true)}>
            Retirer du catalogue
          </button>
        )}
        {property.canWithdrawFromCatalog && withdrawalConfirmationVisible && (
          <div className="publication-confirmation" role="alertdialog" aria-labelledby="withdrawal-confirmation-title" aria-describedby="withdrawal-confirmation-description">
            <h3 id="withdrawal-confirmation-title">Retirer ce bien du catalogue ?</h3>
            <p id="withdrawal-confirmation-description">Il ne sera plus visible publiquement, mais restera disponible dans votre portefeuille.</p>
            <fieldset disabled={withdrawing}>
              <button className="primary-action" type="button" onClick={() => void confirmWithdrawal()}>{withdrawing ? "Retrait en cours…" : "Confirmer le retrait"}</button>
              <button className="secondary-action" type="button" onClick={() => setWithdrawalConfirmationVisible(false)}>Annuler</button>
            </fieldset>
            {withdrawing && <p className="muted-status" role="status">Retrait du catalogue en cours…</p>}
          </div>
        )}
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
          <p id="publication-confirmation-description">Le bien deviendra visible dans le catalogue public. Vous pourrez continuer à le modifier et le retirer ultérieurement.</p>
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
