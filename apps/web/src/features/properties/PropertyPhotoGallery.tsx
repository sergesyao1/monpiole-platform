import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { propertyPhotoCategoryLabels, type Property, type PropertyPhoto } from "./property-model.js";
import { Button, EmptyState, Field, StatusBadge } from "../../ui/index.js";

export interface PropertyPhotoGalleryApi {
  registerPropertyPhoto(propertyId: string, input: Readonly<{
    category: PropertyPhoto["category"];
    contentType: PropertyPhoto["contentType"];
    contentBase64: string;
  }>): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  retrievePropertyPhotoContent(photo: PropertyPhoto): Promise<Blob>;
  selectPropertyPrimaryPhoto(propertyId: string, photoId: string): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  reorderPropertyPhotos(propertyId: string, photoIds: readonly string[]): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  deletePropertyPhoto(propertyId: string, photoId: string): Promise<void>;
}

export function PropertyPhotoGallery({ property, api, onPhotosChanged, onReconnect }: Readonly<{
  property: Property;
  api: PropertyPhotoGalleryApi;
  onPhotosChanged: (photos: readonly PropertyPhoto[]) => void;
  onReconnect?: () => void;
}>) {
  const [busyPhotoId, setBusyPhotoId] = useState<string>();
  const [error, setError] = useState<PropertyUiError>();
  const [success, setSuccess] = useState<string>();
  const inFlight = useRef(false);
  const photos = property.photos ?? [];

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const file = (form.elements.namedItem("photo") as HTMLInputElement | null)?.files?.[0];
    const category = (form.elements.namedItem("category") as HTMLSelectElement | null)?.value;
    if (file === undefined || file.size === 0 || category === undefined) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
      setError({ kind: "validation", message: "Choisissez une image JPEG, PNG ou WebP." });
      return;
    }
    inFlight.current = true; setBusyPhotoId("upload"); setError(undefined); setSuccess(undefined);
    try {
      const result = await api.registerPropertyPhoto(property.propertyId, {
        category: category as PropertyPhoto["category"],
        contentType: file.type,
        contentBase64: await fileAsBase64(file),
      });
      onPhotosChanged(result.photos);
      form.reset();
      setSuccess("Photo ajoutée à la galerie.");
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { inFlight.current = false; setBusyPhotoId(undefined); }
  }

  async function selectPrimary(photoId: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusyPhotoId(photoId); setError(undefined); setSuccess(undefined);
    try {
      onPhotosChanged((await api.selectPropertyPrimaryPhoto(property.propertyId, photoId)).photos);
      setSuccess("Photo principale mise à jour.");
    }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { inFlight.current = false; setBusyPhotoId(undefined); }
  }

  async function deletePhoto(photo: PropertyPhoto) {
    if (inFlight.current || photo.isPrimary) return;
    if (!window.confirm("Supprimer définitivement cette photo ?")) return;
    inFlight.current = true; setBusyPhotoId(photo.photoId); setError(undefined); setSuccess(undefined);
    try {
      await api.deletePropertyPhoto(property.propertyId, photo.photoId);
      onPhotosChanged(photos.filter((candidate) => candidate.photoId !== photo.photoId)
        .map((candidate, position) => ({ ...candidate, position })));
      setSuccess("Photo supprimée de la galerie.");
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { inFlight.current = false; setBusyPhotoId(undefined); }
  }

  async function movePhoto(photoId: string, direction: -1 | 1) {
    if (inFlight.current) return;
    const currentIndex = photos.findIndex((photo) => photo.photoId === photoId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= photos.length) return;
    const ordered = [...photos];
    [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex]!, ordered[currentIndex]!];
    inFlight.current = true; setBusyPhotoId(`order-${photoId}`); setError(undefined); setSuccess(undefined);
    try {
      onPhotosChanged((await api.reorderPropertyPhotos(property.propertyId, ordered.map((photo) => photo.photoId))).photos);
      setSuccess("Ordre de la galerie enregistré.");
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { inFlight.current = false; setBusyPhotoId(undefined); }
  }

  return (
    <section className="content-panel" aria-labelledby="property-photo-gallery-title" aria-busy={busyPhotoId !== undefined}>
      <div className="section-heading">
        <div><p className="eyebrow">Médias</p><h2 id="property-photo-gallery-title">Galerie photos</h2></div>
        <StatusBadge tone="info">{photos.length} photo{photos.length > 1 ? "s" : ""}</StatusBadge>
      </div>
      {error && <PropertyFeedback error={error} onReconnect={onReconnect} />}
      {success && <p className="form-success" role="status">{success}</p>}
      <form className="property-photo-upload" onSubmit={(event) => void uploadPhoto(event)}>
        <Field label="Vue photographiée"><select name="category" defaultValue="OTHER">
          {Object.entries(propertyPhotoCategoryLabels).map(([category, label]) => (
            <option key={category} value={category}>{label}</option>
          ))}
        </select></Field>
        <Field label="Fichier image"><input name="photo" type="file" required accept="image/jpeg,image/png,image/webp" /></Field>
        <Button variant="secondary" type="submit" loading={busyPhotoId === "upload"} disabled={busyPhotoId !== undefined} loadingLabel="Enregistrement de la photo…">Ajouter la photo</Button>
      </form>
      {photos.length === 0 ? (
        <EmptyState title="Aucune photo" description="Ajoutez une photo puis choisissez celle qui représentera le bien avant sa première publication." />
      ) : (
        <ul className="property-photo-grid">
          {photos.map((photo, index) => (
            <li key={photo.photoId} className={photo.isPrimary ? "is-primary" : undefined}>
              <div className="property-photo-preview">
                <PrivatePropertyPhoto photo={photo} api={api} />
                {photo.isPrimary && <span className="primary-photo-badge">Photo principale</span>}
              </div>
              <div className="property-photo-actions">
                <span>{propertyPhotoCategoryLabels[photo.category]}</span>
                <div className="property-photo-order-actions" aria-label={`Position de la photo ${index + 1}`}>
                  <Button variant="secondary" disabled={busyPhotoId !== undefined || index === 0}
                    onClick={() => void movePhoto(photo.photoId, -1)}>Monter la photo</Button>
                  <Button variant="secondary" disabled={busyPhotoId !== undefined || index === photos.length - 1}
                    onClick={() => void movePhoto(photo.photoId, 1)}>Descendre la photo</Button>
                </div>
                {!photo.isPrimary && (
                  <Button variant="secondary" disabled={busyPhotoId !== undefined}
                    onClick={() => void selectPrimary(photo.photoId)}>
                    {busyPhotoId === photo.photoId ? "Sélection en cours…" : "Définir comme photo principale"}
                  </Button>
                )}
                <Button variant="danger" disabled={busyPhotoId !== undefined || photo.isPrimary}
                  title={photo.isPrimary ? "Sélectionnez d’abord une photo remplaçante" : undefined}
                  onClick={() => void deletePhoto(photo)}>
                  Supprimer la photo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PrivatePropertyPhoto({ photo, api }: Readonly<{ photo: PropertyPhoto; api: PropertyPhotoGalleryApi }>) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void api.retrievePropertyPhotoContent(photo).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    };
  }, [api, photo]);
  return source === undefined
    ? <div className="property-photo-loading" role="status">Chargement de la photo…</div>
    : <img src={source} alt={`Vue ${propertyPhotoCategoryLabels[photo.category].toLowerCase()} du bien`} />;
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire la photo."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(",")) reject(new Error("Impossible de lire la photo."));
      else resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
