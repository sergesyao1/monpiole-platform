import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PropertyPhotoGallery, type PropertyPhotoGalleryApi } from "./PropertyPhotoGallery.js";
import type { Property, PropertyPhoto } from "./property-model.js";

const PROPERTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const first: PropertyPhoto = { photoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", category: "BUILDING_EXTERIOR_OR_ENTRANCE", status: "AVAILABLE",
  mediaKind: "IMAGE", position: 0,
  contentPath: `/v1/properties/${PROPERTY_ID}/photos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/content`,
  contentType: "image/png", contentByteSize: 8, contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", isPrimary: true,
  registeredAt: "2026-08-25T12:00:00.000Z", availableAt: "2026-08-25T12:01:00.000Z" };
const second: PropertyPhoto = { ...first, photoId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", category: "LIVING_ROOM_OR_MAIN_ROOM", position: 1,
  contentPath: `/v1/properties/${PROPERTY_ID}/photos/cccccccc-cccc-4ccc-8ccc-cccccccccccc/content`, isPrimary: false };
const property: Property = { propertyId: PROPERTY_ID, title: "Maison Lagune", propertyType: "HOUSE", transactionType: "SALE",
  status: "PUBLISHED", publishedAt: "2026-08-25T14:00:00.000Z", canWithdrawFromCatalog: true, structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T14:00:00.000Z",
  photos: [first, second], primaryPhoto: first };

function Harness({ api }: Readonly<{ api: PropertyPhotoGalleryApi }>) {
  const [value, setValue] = useState(property);
  return <PropertyPhotoGallery property={value} api={api} onPhotosChanged={(photos) => {
    const primaryPhoto = photos.find((photo) => photo.isPrimary);
    setValue({ ...value, photos, ...(primaryPhoto === undefined ? {} : { primaryPhoto }) });
  }} />;
}

describe("galerie des photos du bien", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeAll(() => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:photo") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });
  it("affiche le badge et remplace la photo principale d’un bien publié", async () => {
    const replacement = [{ ...first, isPrimary: false }, { ...second, isPrimary: true }];
    const api = { registerPropertyPhoto: vi.fn(), retrievePropertyPhotoContent: vi.fn().mockResolvedValue(new Blob()), selectPropertyPrimaryPhoto: vi.fn().mockResolvedValue({ photos: replacement }), reorderPropertyPhotos: vi.fn(), deletePropertyPhoto: vi.fn() };
    render(<Harness api={api} />);
    expect(screen.getByText("Photo principale")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Supprimer la photo" })[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Définir comme photo principale" }));
    await waitFor(() => expect(api.selectPropertyPrimaryPhoto).toHaveBeenCalledWith(PROPERTY_ID, second.photoId));
    expect((await screen.findByAltText("Vue séjour ou pièce principale du bien")).parentElement).toHaveTextContent("Photo principale");
  });

  it("supprime seulement une photo non principale", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = { registerPropertyPhoto: vi.fn(), retrievePropertyPhotoContent: vi.fn().mockResolvedValue(new Blob()), selectPropertyPrimaryPhoto: vi.fn(), reorderPropertyPhotos: vi.fn(), deletePropertyPhoto: vi.fn().mockResolvedValue(undefined) };
    render(<Harness api={api} />);
    const deletes = screen.getAllByRole("button", { name: "Supprimer la photo" });
    expect(deletes[0]).toBeDisabled();
    fireEvent.click(deletes[1]!);
    expect(window.confirm).toHaveBeenCalledWith("Supprimer définitivement cette photo ?");
    await waitFor(() => expect(api.deletePropertyPhoto).toHaveBeenCalledWith(PROPERTY_ID, second.photoId));
    expect(screen.queryByAltText("Vue séjour ou pièce principale du bien")).not.toBeInTheDocument();
  });

  it("enregistre le contenu choisi avec sa catégorie", async () => {
    const api = {
      registerPropertyPhoto: vi.fn().mockResolvedValue({ photos: [first, second] }),
      retrievePropertyPhotoContent: vi.fn().mockResolvedValue(new Blob()),
      selectPropertyPrimaryPhoto: vi.fn(), reorderPropertyPhotos: vi.fn(), deletePropertyPhoto: vi.fn(),
    };
    render(<Harness api={api} />);
    fireEvent.change(screen.getByLabelText("Vue photographiée"), { target: { value: "KITCHEN_OR_KITCHENETTE" } });
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "cuisine.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Fichier image"), { target: { files: [file] } });
    fireEvent.submit(screen.getByRole("button", { name: "Ajouter la photo" }).closest("form")!);
    await waitFor(() => expect(api.registerPropertyPhoto).toHaveBeenCalledWith(PROPERTY_ID, {
      category: "KITCHEN_OR_KITCHENETTE", contentType: "image/png", contentBase64: "iVBORw0KGgo=",
    }));
  });

  it("réordonne avec des contrôles accessibles et reflète l’ordre serveur", async () => {
    const reordered = [{ ...second, position: 0 }, { ...first, position: 1 }];
    const api = {
      registerPropertyPhoto: vi.fn(), retrievePropertyPhotoContent: vi.fn().mockResolvedValue(new Blob()),
      selectPropertyPrimaryPhoto: vi.fn(), reorderPropertyPhotos: vi.fn().mockResolvedValue({ photos: reordered }),
      deletePropertyPhoto: vi.fn(),
    };
    render(<Harness api={api} />);
    const moveUp = screen.getAllByRole("button", { name: "Monter la photo" });
    expect(moveUp[0]).toBeDisabled();
    fireEvent.click(moveUp[1]!);
    await waitFor(() => expect(api.reorderPropertyPhotos).toHaveBeenCalledWith(PROPERTY_ID, [second.photoId, first.photoId]));
    expect(screen.getByRole("status")).toHaveTextContent("Ordre de la galerie enregistré");
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Séjour ou pièce principale");
  });
});
