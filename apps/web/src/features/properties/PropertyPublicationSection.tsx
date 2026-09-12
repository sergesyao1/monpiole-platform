import { useRef, useState } from "react";

import type { PropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  formatPublicationDate, propertyStatusLabels,
  type Property, type PropertyPublicationReadiness,
} from "./property-model.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { Alert, Button, StatusBadge } from "../../ui/index.js";

export interface PropertyPublicationApi {
  publishProperty: PropertyApi["publishProperty"];
  withdrawPropertyFromCatalog: PropertyApi["withdrawPropertyFromCatalog"];
}

export function PropertyPublicationSection({ property, publicationReadiness, api, onPublished, onWithdrawn, onReconnect }: Readonly<{
  property: Property;
  publicationReadiness: PropertyPublicationReadiness;
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
          <StatusBadge tone="warning">{propertyStatusLabels.WITHDRAWN}</StatusBadge>
        </div>
        {withdrawnHere && <Alert tone="success" title="Le bien a été retiré du catalogue." />}
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
          <StatusBadge tone="success">{propertyStatusLabels.PUBLISHED}</StatusBadge>
        </div>
        {publishedHere && <Alert tone="success" title="Le bien est publié." />}
        <p>Publié le {formatPublicationDate(property.publishedAt)}.</p>
        <p className="muted-status">Ce bien est visible dans le catalogue public.</p>
        {error && <PropertyFeedback error={error} onReconnect={onReconnect} />}
        {property.canWithdrawFromCatalog && !withdrawalConfirmationVisible && (
          <Button variant="danger" disabled={withdrawing} onClick={() => setWithdrawalConfirmationVisible(true)}>Retirer du catalogue</Button>
        )}
        {property.canWithdrawFromCatalog && withdrawalConfirmationVisible && (
          <div className="publication-confirmation" role="alertdialog" aria-labelledby="withdrawal-confirmation-title" aria-describedby="withdrawal-confirmation-description">
            <h3 id="withdrawal-confirmation-title">Retirer ce bien du catalogue ?</h3>
            <p id="withdrawal-confirmation-description">Il ne sera plus visible publiquement, mais restera disponible dans votre portefeuille.</p>
            <fieldset disabled={withdrawing}>
              <Button variant="danger" loading={withdrawing} loadingLabel="Retrait en cours…" onClick={() => void confirmWithdrawal()}>Confirmer le retrait</Button>
              <Button variant="secondary" onClick={() => setWithdrawalConfirmationVisible(false)}>Annuler</Button>
            </fieldset>
            {withdrawing && <p className="muted-status" role="status">Retrait du catalogue en cours…</p>}
          </div>
        )}
      </section>
    );
  }

  const missing = new Set(publicationReadiness.missingRequirements);
  const commercialTargetReady = !missing.has("COMMERCIAL_TARGET");
  const detailsReady = !missing.has("DETAILS");
  const commercialTermsReady = !missing.has("COMMERCIAL_TERMS");
  const subtypeReady = !missing.has("APARTMENT_SUBTYPE");
  const availablePhotos = property.photos ?? [];
  const minimumReady = !missing.has("PHOTO_MINIMUM");
  const viewsReady = !missing.has("PHOTO_REQUIRED_VIEWS");
  const primaryPhotoReady = !missing.has("PRIMARY_PHOTO");
  const ready = publicationReadiness.ready;

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
        <StatusBadge>{propertyStatusLabels.DRAFT}</StatusBadge>
      </div>
      <p>{ready ? "Ce bien est prêt à être publié." : !commercialTargetReady
        ? "Ce bien n’est pas une annonce commercialisable dans son mode actuel."
        : !primaryPhotoReady ? "Sélectionnez la photo principale qui représentera ce bien dans les annonces."
          : "Complétez les prérequis avant de publier."}</p>
      <ul className="publication-checklist" aria-label="Préparation à la publication">
        {!commercialTargetReady && <li className="is-missing">Ce bien n’est pas publiable individuellement.</li>}
        <li className={detailsReady ? "is-ready" : "is-missing"}>Détails {detailsReady ? "renseignés" : "à compléter"}</li>
        <li className={commercialTermsReady ? "is-ready" : "is-missing"}>Conditions commerciales {commercialTermsReady ? "renseignées" : "à compléter"}</li>
        {property.propertyType === "APARTMENT" && property.transactionType === "LONG_TERM_RENTAL" && (
          <li className={subtypeReady ? "is-ready" : "is-missing"}>Sous-type {subtypeReady ? "renseigné" : "à sélectionner"}</li>
        )}
        <li className={minimumReady ? "is-ready" : "is-missing"}>Nombre de photos {minimumReady ? `suffisant (${availablePhotos.length})` : `insuffisant (${availablePhotos.length})`}</li>
        <li className={viewsReady ? "is-ready" : "is-missing"}>Vues requises {viewsReady ? "présentes" : "à ajouter"}</li>
        <li className={primaryPhotoReady ? "is-ready" : "is-missing"}>Photo principale {primaryPhotoReady ? "sélectionnée" : "à sélectionner"}</li>
      </ul>
      {error && <PropertyFeedback error={error} onReconnect={onReconnect} />}
      {!confirmationVisible && (
        <Button disabled={!ready || publishing} onClick={() => setConfirmationVisible(true)}>Publier le bien</Button>
      )}
      {confirmationVisible && (
        <div className="publication-confirmation" role="alertdialog" aria-labelledby="publication-confirmation-title" aria-describedby="publication-confirmation-description">
          <h3 id="publication-confirmation-title">Confirmer la publication</h3>
          <p id="publication-confirmation-description">Le bien deviendra visible dans le catalogue public. Vous pourrez continuer à le modifier et le retirer ultérieurement.</p>
          <fieldset disabled={publishing}>
            <Button loading={publishing} loadingLabel="Publication en cours…" onClick={() => void confirmPublication()}>Confirmer la publication</Button>
            <Button variant="secondary" onClick={() => setConfirmationVisible(false)}>Annuler</Button>
          </fieldset>
          {publishing && <p className="muted-status" role="status">Publication en cours…</p>}
        </div>
      )}
    </section>
  );
}
