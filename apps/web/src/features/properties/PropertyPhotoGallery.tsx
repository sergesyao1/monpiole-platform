import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { PropertyFeedback } from "./PropertyFeedback.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { propertyPhotoCategoryLabels, type Property, type PropertyPhoto } from "./property-model.js";

export interface PropertyPhotoGalleryApi {
  registerPropertyPhoto(propertyId: string, input: Readonly<{
    category: PropertyPhoto["category"];
    contentType: PropertyPhoto["contentType"];
    contentBase64: string;
  }>): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
  retrievePropertyPhotoContent(photo: PropertyPhoto): Promise<Blob>;
  selectPropertyPrimaryPhoto(propertyId: string, photoId: string): Promise<{ readonly photos: readonly PropertyPhoto[] }>;
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
    inFlight.current = true; setBusyPhotoId("upload"); setError(undefined);
    try {
      const result = await api.registerPropertyPhoto(property.propertyId, {
        category: category as PropertyPhoto["category"],
        contentType: file.type,
        contentBase64: await fileAsBase64(file),
      });
      onPhotosChanged(result.photos);
      form.reset();
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { inFlight.current = false; setBusyPhotoId(undefined); }
  }

  async function selectPrimary(photoId: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusyPhotoId(photoId); setError(undefined);
    try { onPhotosChanged((await api.selectPropertyPrimaryPhoto(property.propertyId, photoId)).photos); }
    catch (caught) { setError(toPropertyUiError(caught)); }
    finally { inFlight.current = false; setBusyPhotoId(undefined); }
  }

  async function deletePhoto(photo: PropertyPhoto) {
    if (inFlight.current || photo.isPrimary) return;
    inFlight.current = true; setBusyPhotoId(photo.photoId); setError(undefined);
    try {
      await api.deletePropertyPhoto(property.propertyId, photo.photoId);
      onPhotosChanged(photos.filter((candidate) => candidate.photoId !== photo.photoId));
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { inFlight.current = false; setBusyPhotoId(undefined); }
  }

  return (
    <section className="content-panel" aria-labelledby="property-photo-gallery-title" aria-busy={busyPhotoId !== undefined}>
      <div className="section-heading">
        <div><p className="eyebrow">Médias</p><h2 id="property-photo-gallery-title">Galerie photos</h2></div>
        <span className="quiet-badge">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
      </div>
      {error && <PropertyFeedback error={error} onReconnect={onReconnect} />}
      <form className="property-photo-upload" onSubmit={(event) => void uploadPhoto(event)}>
        <label>Vue photographiée<select name="category" defaultValue="OTHER">
          {Object.entries(propertyPhotoCategoryLabels).map(([category, label]) => (
            <option key={category} value={category}>{label}</option>
          ))}
        </select></label>
        <label>Fichier image<input name="photo" type="file" required accept="image/jpeg,image/png,image/webp" /></label>
        <button className="secondary-action" type="submit" disabled={busyPhotoId !== undefined}>
          {busyPhotoId === "upload" ? "Enregistrement de la photo…" : "Ajouter la photo"}
        </button>
      </form>
      {photos.length === 0 ? (
        <p className="muted-status">Aucune photo disponible. Une photo principale est obligatoire avant la première publication.</p>
      ) : (
        <ul className="property-photo-grid">
          {photos.map((photo) => (
            <li key={photo.photoId} className={photo.isPrimary ? "is-primary" : undefined}>
              <div className="property-photo-preview">
                <PrivatePropertyPhoto photo={photo} api={api} />
                {photo.isPrimary && <span className="primary-photo-badge">Photo principale</span>}
              </div>
              <div className="property-photo-actions">
                <span>{propertyPhotoCategoryLabels[photo.category]}</span>
                {!photo.isPrimary && (
                  <button className="secondary-action" type="button" disabled={busyPhotoId !== undefined}
                    onClick={() => void selectPrimary(photo.photoId)}>
                    {busyPhotoId === photo.photoId ? "Sélection en cours…" : "Définir comme photo principale"}
                  </button>
                )}
                <button className="danger-action" type="button" disabled={busyPhotoId !== undefined || photo.isPrimary}
                  title={photo.isPrimary ? "Sélectionnez d’abord une photo remplaçante" : undefined}
                  onClick={() => void deletePhoto(photo)}>
                  Supprimer la photo
                </button>
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
