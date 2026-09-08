import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiForbiddenError, ApiSessionExpiredError } from "../../infrastructure/http/api-client.js";
import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import type { PropertyPublicationApi } from "./PropertyPublicationSection.js";
import { PropertyPublicationSection } from "./PropertyPublicationSection.js";
import type { Property, PropertyPublicationReadiness, PropertyPublicationRequirement } from "./property-model.js";

const PROPERTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const primaryPhoto = { photoId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", category: "BUILDING_EXTERIOR_OR_ENTRANCE" as const,
  mediaKind: "IMAGE" as const, position: 0,
  status: "AVAILABLE" as const, contentPath: `/v1/properties/${PROPERTY_ID}/photos/cccccccc-cccc-4ccc-8ccc-cccccccccccc/content` as const,
  contentType: "image/png" as const, contentByteSize: 8,
  contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", isPrimary: true,
  registeredAt: "2026-08-25T12:10:00.000Z", availableAt: "2026-08-25T12:11:00.000Z" };
const draft = {
  propertyId: PROPERTY_ID, title: "Maison Lagune", propertyType: "HOUSE", transactionType: "SALE",
  status: "DRAFT", canWithdrawFromCatalog: false, structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
  createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z",
} satisfies Property;
const ready = {
  ...draft, details: { rooms: 1 }, commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 },
  photos: [primaryPhoto], primaryPhoto,
} satisfies Property;
const photo = (photoId: string, category: typeof primaryPhoto.category | "MAIN_LIVING_SLEEPING_AREA" | "KITCHEN_OR_KITCHENETTE" | "BATHROOM_OR_SHOWER_ROOM" | "OTHER") => ({
  ...primaryPhoto, photoId, category, isPrimary: false,
  contentPath: `/v1/properties/${PROPERTY_ID}/photos/${photoId}/content` as const,
});
const published: Property = {
  ...ready, status: "PUBLISHED", publishedAt: "2026-08-25T16:00:00.000Z", canWithdrawFromCatalog: true, updatedAt: "2026-08-25T16:00:00.000Z",
};

function Harness({ initial = ready, api, onReconnect }: Readonly<{
  initial?: Property; api: Pick<PropertyPublicationApi, "publishProperty"> & Partial<Pick<PropertyPublicationApi, "withdrawPropertyFromCatalog">>; onReconnect?: () => void;
}>) {
  const [property, setProperty] = useState(initial);
  const client: PropertyPublicationApi = { withdrawPropertyFromCatalog: vi.fn(), ...api };
  return <PropertyPublicationSection property={property} publicationReadiness={readiness(property)} api={client} onPublished={setProperty} onWithdrawn={setProperty} onReconnect={onReconnect} />;
}

function readiness(property: Property): PropertyPublicationReadiness {
  const missing: PropertyPublicationRequirement[] = [];
  if (property.details === undefined) missing.push("DETAILS");
  if (property.commercialTerms === undefined) missing.push("COMMERCIAL_TERMS");
  if (property.propertyType === "APARTMENT" && property.transactionType === "LONG_TERM_RENTAL" && property.apartmentSubtype === undefined) missing.push("APARTMENT_SUBTYPE");
  if (property.primaryPhoto === undefined) missing.push("PRIMARY_PHOTO");
  if ((property.photos?.length ?? 0) < (property.propertyType === "APARTMENT" && property.transactionType === "LONG_TERM_RENTAL" ? 6 : 1)) missing.push("PHOTO_MINIMUM");
  return { ready: missing.length === 0, missingRequirements: missing };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => vi.clearAllMocks());

describe("publication d’un bien", () => {
  it("explique les prérequis manquants et désactive la publication", () => {
    const publishProperty = vi.fn();
    render(<Harness initial={draft} api={{ publishProperty }} />);
    expect(screen.getByText("Sélectionnez la photo principale qui représentera ce bien dans les annonces.")).toBeInTheDocument();
    expect(screen.getByText("Détails à compléter")).toBeInTheDocument();
    expect(screen.getByText("Conditions commerciales à compléter")).toBeInTheDocument();
    expect(screen.getByText("Photo principale à sélectionner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publier le bien" })).toBeDisabled();
    expect(publishProperty).not.toHaveBeenCalled();
  });

  it("bloque la publication prête sans photo principale avec le message requis", () => {
    const withoutPrimary: Property = { ...ready, photos: [], primaryPhoto: undefined };
    render(<Harness initial={withoutPrimary} api={{ publishProperty: vi.fn() }} />);
    expect(screen.getByText("Sélectionnez la photo principale qui représentera ce bien dans les annonces.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publier le bien" })).toBeDisabled();
  });

  it("déclare prêt un Studio avec les quatre vues imposées et deux vues libres", () => {
    const studioPhotos = [
      primaryPhoto,
      photo("11111111-1111-4111-8111-111111111111", "MAIN_LIVING_SLEEPING_AREA"),
      photo("22222222-2222-4222-8222-222222222222", "KITCHEN_OR_KITCHENETTE"),
      photo("33333333-3333-4333-8333-333333333333", "BATHROOM_OR_SHOWER_ROOM"),
      photo("44444444-4444-4444-8444-444444444444", "OTHER"),
      photo("55555555-5555-4555-8555-555555555555", "OTHER"),
    ];
    render(<Harness initial={{
      ...ready, propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO",
      commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 250000, rentPeriod: "MONTH" },
      photos: studioPhotos, primaryPhoto,
    }} api={{ publishProperty: vi.fn() }} />);
    expect(screen.getByText("Ce bien est prêt à être publié.")).toBeInTheDocument();
    expect(screen.queryByText(/séjour ou pièce principale/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/chambre ou espace nuit/iu)).not.toBeInTheDocument();
  });

  it("demande confirmation, permet d’annuler et empêche une double soumission", async () => {
    const pending = deferred<Property>();
    const publishProperty = vi.fn(() => pending.promise);
    render(<Harness api={{ publishProperty }} />);
    expect(screen.getByText("Ce bien est prêt à être publié.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publier le bien" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Le bien deviendra visible dans le catalogue public");
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publier le bien" }));
    const confirmation = screen.getByRole("button", { name: "Confirmer la publication" });
    fireEvent.click(confirmation);
    fireEvent.click(confirmation);
    expect(screen.getByRole("button", { name: "Publication en cours…" })).toBeDisabled();
    expect(publishProperty).toHaveBeenCalledTimes(1);
    expect(publishProperty).toHaveBeenCalledWith(PROPERTY_ID);
    pending.resolve(published);
    expect(await screen.findByText("Le bien est publié.")).toBeInTheDocument();
    expect(screen.getByText("Publié")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publier|publication/iu })).not.toBeInTheDocument();
  });

  it("affiche une Property déjà publiée avec son action de retrait autorisée", () => {
    render(<Harness initial={published} api={{ publishProperty: vi.fn() }} />);
    expect(screen.getByText("Publié")).toBeInTheDocument();
    expect(screen.getByText(/Publié le 25 août 2026/)).toBeInTheDocument();
    expect(screen.getByText("Ce bien est visible dans le catalogue public.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer du catalogue" })).toBeInTheDocument();
    expect(screen.queryByText("PUBLISHED")).not.toBeInTheDocument();
  });

  it("confirme le retrait, bloque le double clic et actualise immédiatement l’état privé", async () => {
    const pending = deferred<Property>();
    const withdrawPropertyFromCatalog = vi.fn(() => pending.promise);
    const withdrawn: Property = {
      ...published, status: "WITHDRAWN", withdrawnAt: "2026-08-25T17:00:00.000Z",
      canWithdrawFromCatalog: false, updatedAt: "2026-08-25T17:00:00.000Z",
    };
    render(<Harness initial={published} api={{ publishProperty: vi.fn(), withdrawPropertyFromCatalog }} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer du catalogue" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Retirer ce bien du catalogue ?");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Il ne sera plus visible publiquement, mais restera disponible dans votre portefeuille.");
    const confirmation = screen.getByRole("button", { name: "Confirmer le retrait" });
    fireEvent.click(confirmation);
    fireEvent.click(confirmation);
    expect(screen.getByRole("button", { name: "Retrait en cours…" })).toBeDisabled();
    expect(withdrawPropertyFromCatalog).toHaveBeenCalledTimes(1);
    expect(withdrawPropertyFromCatalog).toHaveBeenCalledWith(PROPERTY_ID);
    pending.resolve(withdrawn);
    expect(await screen.findByText("Le bien a été retiré du catalogue.")).toBeInTheDocument();
    expect(screen.getByText("Retiré du catalogue")).toBeInTheDocument();
    expect(screen.getByText(/Retiré le 25 août 2026/)).toBeInTheDocument();
    expect(screen.getByText(/reste disponible dans votre portefeuille/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirer du catalogue" })).not.toBeInTheDocument();
  });

  it("annule la confirmation de retrait sans appeler l’API", () => {
    const withdrawPropertyFromCatalog = vi.fn();
    render(<Harness initial={published} api={{ publishProperty: vi.fn(), withdrawPropertyFromCatalog }} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer du catalogue" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(withdrawPropertyFromCatalog).not.toHaveBeenCalled();
  });

  it("masque l’action sans affordance et dans l’état retiré", () => {
    const unauthorized: Property = { ...published, canWithdrawFromCatalog: false };
    const first = render(<Harness initial={unauthorized} api={{ publishProperty: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: "Retirer du catalogue" })).not.toBeInTheDocument();
    first.unmount();
    const withdrawn: Property = { ...published, status: "WITHDRAWN", withdrawnAt: "2026-08-25T17:00:00.000Z", canWithdrawFromCatalog: false };
    render(<Harness initial={withdrawn} api={{ publishProperty: vi.fn() }} />);
    expect(screen.getByText("Retiré du catalogue")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("affiche une erreur de retrait et permet une nouvelle tentative", async () => {
    const withdrawn: Property = { ...published, status: "WITHDRAWN", withdrawnAt: "2026-08-25T17:00:00.000Z", canWithdrawFromCatalog: false };
    const withdrawPropertyFromCatalog = vi.fn()
      .mockRejectedValueOnce(new ApiProblem({
        type: "https://api.monpiole.example/problems/property-not-published", title: "Property is not published",
        status: 409, code: "PROPERTY_NOT_PUBLISHED", correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }))
      .mockResolvedValueOnce(withdrawn);
    render(<Harness initial={published} api={{ publishProperty: vi.fn(), withdrawPropertyFromCatalog }} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer du catalogue" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le retrait" }));
    expect(await screen.findByText("Seul un bien actuellement publié peut être retiré du catalogue.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmer le retrait" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le retrait" }));
    expect(await screen.findByText("Le bien a été retiré du catalogue.")).toBeInTheDocument();
    expect(withdrawPropertyFromCatalog).toHaveBeenCalledTimes(2);
  });

  it.each([
    [new ApiForbiddenError(), "Vous ne disposez pas de l’autorisation nécessaire"],
    [new ApiProblem({
      type: "https://api.monpiole.example/problems/property-not-found", title: "Property not found",
      status: 404, code: "PROPERTY_NOT_FOUND", correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }), "Ce bien est introuvable ou n’est pas accessible"],
    [new TypeError("network unavailable"), "Une erreur inattendue est survenue"],
  ] as const)("rend une erreur de retrait sûre et réessayable", async (failure, expected) => {
    const withdrawPropertyFromCatalog = vi.fn().mockRejectedValue(failure);
    render(<Harness initial={published} api={{ publishProperty: vi.fn(), withdrawPropertyFromCatalog }} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer du catalogue" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le retrait" }));
    expect(await screen.findByText(new RegExp(expected))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer le retrait" })).toBeEnabled();
  });

  it.each([
    ["session", () => new ApiSessionExpiredError(), "Votre session n’est plus utilisable"],
    ["interdiction", () => new ApiForbiddenError(), "Vous ne disposez pas de l’autorisation nécessaire"],
    ["prérequis", () => new ApiProblem({
      type: "https://api.monpiole.example/problems/property-publication-requirements-not-met",
      title: "Property publication requirements not met", status: 409,
      code: "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET", correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      errors: [{ path: "property.details", code: "required_for_publication" }],
    }), "Complétez les détails et les conditions commerciales"],
    ["réseau", () => new TypeError("network unavailable"), "Une erreur inattendue est survenue"],
  ] as const)("présente l’erreur %s en français et permet un nouvel essai", async (_kind, failure, expected) => {
    const publishProperty = vi.fn().mockRejectedValueOnce(failure()).mockResolvedValueOnce(published);
    const reconnect = vi.fn();
    render(<Harness api={{ publishProperty }} onReconnect={reconnect} />);
    fireEvent.click(screen.getByRole("button", { name: "Publier le bien" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la publication" }));
    expect(await screen.findByText(new RegExp(expected))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmer la publication" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la publication" }));
    expect(await screen.findByText("Le bien est publié.")).toBeInTheDocument();
    expect(publishProperty).toHaveBeenCalledTimes(2);
  });
});
