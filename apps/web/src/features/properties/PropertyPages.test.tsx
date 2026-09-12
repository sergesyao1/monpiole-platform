import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionContext, type Session } from "../../auth/session.js";
import { applicationRoutes } from "../../app/routes.js";
import type { Property } from "./property-model.js";

const PROPERTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const property = {
  propertyId: PROPERTY_ID, title: "Maison des Lagunes", description: "Une maison familiale.",
  propertyType: "HOUSE", transactionType: "LONG_TERM_RENTAL", status: "DRAFT", canWithdrawFromCatalog: false, structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue des Jardins" },
  createdAt: "2026-08-27T10:00:00.000Z", updatedAt: "2026-08-27T10:00:00.000Z",
} satisfies Property;
const session: Session = {
  status: "authenticated", user: { name: "Jeanne Test" }, login: vi.fn(async () => undefined),
  logout: async () => undefined, getAccessToken: vi.fn(async () => "property-test-token"),
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" } });
}
function problem(status: number, code: string) {
  return json({ type: "https://api.monpiole.example/problems/test", title: "Erreur", status, code, correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, status);
}
function ownerPage(items: readonly unknown[] = []) { return { items, pageInfo: { nextCursor: null, hasNextPage: false } }; }
function renderPath(path: string) {
  const fixtureFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.endsWith("/workspace")) return fixtureFetch(input, init);
    const propertyResponse = await fixtureFetch(url.slice(0, -"/workspace".length), init);
    if (!propertyResponse.ok) return propertyResponse;
    const current = await propertyResponse.json() as Property;
    const ownershipResponse = await fixtureFetch(url.replace("/workspace", "/owners"), init);
    const ownerships = ownershipResponse.ok ? await ownershipResponse.json() as readonly { ownerId: string; ownershipShare: number }[] : [];
    const owners = await Promise.all(ownerships.map(async (ownership) => {
      const response = await fixtureFetch(url.replace(`/properties/${PROPERTY_ID}/workspace`, `/property-owners/${ownership.ownerId}`), init);
      const owner = response.ok ? await response.json() as { ownerType: string; firstName?: string; lastName?: string; legalName?: string } : undefined;
      return { ownerId: ownership.ownerId, ownershipShare: ownership.ownershipShare, displayName: owner?.ownerType === "INDIVIDUAL" ? `${owner.firstName} ${owner.lastName}` : owner?.legalName ?? "Propriétaire non consultable" };
    }));
    return json(workspace(current, owners));
  });
  return render(<SessionContext value={session}><RouterProvider router={createMemoryRouter(applicationRoutes, { initialEntries: [path] })} /></SessionContext>);
}

function workspace(current: Property, owners: readonly { ownerId: string; ownershipShare: number; displayName: string }[] = []) {
  const missing = [
    ...(current.details === undefined ? ["DETAILS"] : []),
    ...(current.commercialTerms === undefined ? ["COMMERCIAL_TERMS"] : []),
    ...(current.primaryPhoto === undefined ? ["PRIMARY_PHOTO"] : []),
    ...((current.photos?.length ?? 0) < 1 ? ["PHOTO_MINIMUM"] : []),
  ];
  return {
    property: current,
    availability: { propertyId: current.propertyId, source: "DIRECT", structuralRole: current.structuralRole === "UNIT" ? "UNIT" : "STANDALONE", configured: false, canUpdateAvailability: true },
    publicationReadiness: { ready: missing.length === 0, missingRequirements: missing },
    owners,
    composition: { buildingCount: 0, unitCount: 0 },
    contracts: { totalCount: 0, draftCount: 0, activeCount: 0, endedCount: 0, cancelledCount: 0 },
    leaseEligibility: current.transactionType === "LONG_TERM_RENTAL" && current.structuralRole !== "COMPOSITE"
      ? { eligible: true, blockedByActiveLease: false } : { eligible: false, reasonCode: current.transactionType !== "LONG_TERM_RENTAL" ? "NOT_LONG_TERM_RENTAL" : "INVALID_RENTAL_TARGET" },
    capabilities: { canUpdateCoreInformation: true, canUpdateDetails: true, canUpdatePricing: true, canUpdateAvailability: true, canManagePhotos: true, canPublish: true, canWithdrawFromCatalog: current.canWithdrawFromCatalog, canManageOwners: true, canManageComposition: true, canViewContracts: false, canCreateContract: false },
  };
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("vertical slice Web Property", () => {
  it("crée directement un immeuble avec un mode commercial explicite", async () => {
    const created = { ...property, title: "Immeuble Horizon", propertyType: "BUILDING" as const,
      commercializationMode: "WHOLE_BUILDING" as const, structuralRole: "COMPOSITE" as const };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/properties") && init?.method === "POST") return json(created, 201);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`)) return json(created);
      if (url.endsWith("/owners")) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      if (url.endsWith("/buildings")) return json({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
      return problem(500, "UNEXPECTED");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPath("/properties/new");
    fireEvent.change(screen.getByLabelText("Titre du bien"), { target: { value: "Immeuble Horizon" } });
    fireEvent.change(screen.getByLabelText("Type de bien"), { target: { value: "BUILDING" } });
    fireEvent.change(screen.getByLabelText("Mode de commercialisation"), { target: { value: "WHOLE_BUILDING" } });
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Abidjan" } });
    fireEvent.change(screen.getByLabelText("Quartier"), { target: { value: "Cocody" } });
    fireEvent.change(screen.getByLabelText("Adresse"), { target: { value: "Rue 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le bien" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/v1/properties"), expect.objectContaining({ method: "POST" })));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ propertyType: "BUILDING", commercializationMode: "WHOLE_BUILDING" });
  });
  it("désactive les contrats et explique la raison pour un bien en vente", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`)) return json({ ...property, transactionType: "SALE" });
      if (url.endsWith("/owners")) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      if (url.endsWith("/buildings")) return json({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
      return problem(500, "UNEXPECTED");
    }));
    renderPath(`/properties/${PROPERTY_ID}`);
    const navigation = await screen.findByRole("navigation", { name: "Sections de la fiche" });
    expect(within(navigation).queryByRole("link", { name: "Clients et contrats" })).not.toBeInTheDocument();
    expect(within(navigation).getByText("Clients et contrats")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Gérer les contrats" })).toBeDisabled();
    expect(screen.getByText("Les contrats de bail sont réservés aux biens proposés en location longue durée.")).toBeVisible();
  });
  it.each([
    ["#property-inquiries", "Demandes", "property-inquiries"],
    ["#property-applications", "Candidatures", "property-applications"],
  ])("révèle la section commerciale ciblée par %s", async (hash, label, targetId) => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`)) return json(property);
      if (url.endsWith("/owners")) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      if (url.endsWith("/photos")) return json({ photos: [] });
      if (url.endsWith("/photo-standard")) return json({ minimumPhotoCount: 1, requiredCategories: [] });
      if (url.endsWith("/geolocation")) return problem(404, "PROPERTY_GEOLOCATION_NOT_FOUND");
      if (url.endsWith("/v1/amenities")) return json({ items: [] });
      if (url.endsWith("/amenities")) return json({ amenityCodes: [] });
      if (url.endsWith("/inquiries") || url.endsWith("/applications") || url.endsWith("/buildings")) {
        return json({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
      }
      return problem(500, "UNEXPECTED");
    }));
    renderPath(`/properties/${PROPERTY_ID}${hash}`);
    const propertyNavigation = await screen.findByRole("navigation", { name: "Sections de la fiche" });
    expect(within(propertyNavigation).getByRole("link", { name: label })).toHaveAttribute("aria-current", "location");
    expect(document.getElementById(targetId)).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" }));
  });

  it.each([
    ["STANDALONE", "Bien indépendant"],
    ["UNIT", "Unité d’immeuble"],
  ] as const)("affiche l’organisation %s en français", async (structuralRole, label) => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`)) return json({ ...property, structuralRole });
      if (url.endsWith("/owners")) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      if (url.endsWith("/buildings")) return json({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
      return problem(500, "UNEXPECTED");
    }));
    renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByRole("heading", { name: property.title });
    expect(screen.getByText(label, { selector: "dd" })).toBeVisible();
  });

  it("crée un bien avec le bearer réel puis ouvre sa fiche", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/properties") && init?.method === "POST") return json(property, 201);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/owners`)) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage([{
        ownerType: "INDIVIDUAL", ownerId: OWNER_ID, firstName: "Awa", lastName: "Koné",
        createdAt: property.createdAt, updatedAt: property.updatedAt,
      }]));
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`)) return json(property);
      return problem(500, "UNEXPECTED");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPath("/properties/new");
    fireEvent.change(screen.getByLabelText("Titre du bien"), { target: { value: property.title } });
    fireEvent.change(screen.getByLabelText("Type de bien"), { target: { value: "HOUSE" } });
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Abidjan" } });
    fireEvent.change(screen.getByLabelText("Quartier"), { target: { value: "Cocody" } });
    fireEvent.change(screen.getByLabelText("Adresse"), { target: { value: "Rue des Jardins" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le bien" }));
    expect(await screen.findByRole("heading", { name: property.title })).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(new Headers(createCall?.[1]?.headers).get("authorization")).toBe("Bearer property-test-token");
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      title: property.title, propertyType: "HOUSE", transactionType: "LONG_TERM_RENTAL",
      location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue des Jardins" },
    });
  });

  it("lit un bien et ses propriétaires depuis les vraies routes API", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`)) return json(property);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/owners`)) return json([{ propertyId: PROPERTY_ID, ownerId: OWNER_ID, ownershipShare: 60, createdAt: property.createdAt }]);
      if (url.endsWith(`/v1/property-owners/${OWNER_ID}`)) return json({ ownerType: "INDIVIDUAL", ownerId: OWNER_ID, firstName: "Awa", lastName: "Koné", createdAt: property.createdAt, updatedAt: property.updatedAt });
      if (url.includes("/v1/property-owners?")) return json(ownerPage([{
        ownerType: "INDIVIDUAL", ownerId: OWNER_ID, firstName: "Awa", lastName: "Koné",
        createdAt: property.createdAt, updatedAt: property.updatedAt,
      }]));
      return problem(500, "UNEXPECTED");
    }));
    renderPath(`/properties/${PROPERTY_ID}`);
    expect(await screen.findByRole("heading", { name: property.title })).toBeInTheDocument();
    expect(screen.getAllByText("Maison").length).toBeGreaterThan(0);
    expect(screen.getByText("À renseigner · Occupation à renseigner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vue d’ensemble" })).toHaveAttribute("aria-current", "location");
    expect(await screen.findByText("Awa Koné")).toBeInTheDocument();
    expect(screen.getByText("60 %")).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Awa Koné — déjà affecté" })).toBeDisabled();
  });

  it("met à jour séparément les caractéristiques et la tarification avancée", async () => {
    const detailsUpdated = { ...property, details: { rooms: 4, bedrooms: 3, furnished: false } };
    const pricingUpdated = { ...detailsUpdated, commercialTerms: {
      kind: "LONG_TERM_RENTAL" as const, currency: "XOF" as const, rentAmountMinor: 350000,
      rentPeriod: "MONTH" as const, securityDepositAmountMinor: 700000,
      chargesAmountMinor: 25000, agencyFeeAmountMinor: 350000,
    } };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/details`) && init?.method === "PUT") return json(detailsUpdated);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/pricing`) && init?.method === "PUT") return json(pricingUpdated);
      if (url.endsWith("/owners")) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      return json(property);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByRole("heading", { name: property.title });
    expect(await screen.findByText("Aucun propriétaire n’est disponible. Créez-en un depuis l’annuaire.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pièces"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Chambres"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les caractéristiques" }));
    await screen.findByText("Les informations du bien sont à jour.");
    fireEvent.change(screen.getByLabelText("Loyer mensuel (FCFA)"), { target: { value: "350000" } });
    fireEvent.change(screen.getByLabelText("Dépôt de garantie (FCFA)"), { target: { value: "700000" } });
    fireEvent.change(screen.getByLabelText("Charges (FCFA)"), { target: { value: "25000" } });
    fireEvent.change(screen.getByLabelText("Frais d’agence (FCFA)"), { target: { value: "350000" } });
    expect(screen.queryByText(/unité mineure/iu)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la tarification" }));
    expect(await screen.findByText("Les informations du bien sont à jour.")).toBeInTheDocument();
    const detailsCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/details") && init?.method === "PUT");
    expect(JSON.parse(String(detailsCall?.[1]?.body))).toEqual({
      details: { rooms: 4, bedrooms: 3, furnished: false },
    });
    const pricingCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/pricing") && init?.method === "PUT");
    expect(new Headers(pricingCall?.[1]?.headers).get("authorization")).toBe("Bearer property-test-token");
    expect(JSON.parse(String(pricingCall?.[1]?.body))).toEqual({
      kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 350000, rentPeriod: "MONTH",
      securityDepositAmountMinor: 700000, chargesAmountMinor: 25000, agencyFeeAmountMinor: 350000,
    });
  });

  it("modifie les informations fondamentales avec le bearer et actualise la fiche", async () => {
    const updated = { ...property, title: "Villa Lagune", description: "Vue sur la lagune",
      location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" }, updatedAt: "2026-08-27T11:00:00.000Z" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`) && init?.method === "PUT") return json(updated);
      if (url.endsWith("/owners")) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      return json(property);
    });
    vi.stubGlobal("fetch", fetchMock); renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByRole("heading", { name: property.title });
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Villa Lagune" } });
    fireEvent.change(screen.getByLabelText("Quartier"), { target: { value: "Marcory" } });
    fireEvent.change(screen.getByLabelText("Adresse"), { target: { value: "Zone 4" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Vue sur la lagune" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les informations" }));
    expect(await screen.findByRole("heading", { name: "Villa Lagune" })).toBeInTheDocument();
    expect(screen.getByText("Vue sur la lagune", { selector: "dd" })).toBeInTheDocument();
    const updateCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith(`/v1/properties/${PROPERTY_ID}`) && init?.method === "PUT");
    expect(new Headers(updateCall?.[1]?.headers).get("authorization")).toBe("Bearer property-test-token");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({ title: "Villa Lagune", description: "Vue sur la lagune",
      location: { country: "CI", city: "Abidjan", district: "Marcory", addressLine: "Zone 4" } });
  });
  it("publie depuis la fiche avec le client authentifié bodyless et reflète immédiatement le résultat", async () => {
    const primaryPhoto = { photoId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", category: "BUILDING_EXTERIOR_OR_ENTRANCE" as const,
      mediaKind: "IMAGE" as const, position: 0,
      status: "AVAILABLE" as const,
      contentPath: `/v1/properties/${PROPERTY_ID}/photos/dddddddd-dddd-4ddd-8ddd-dddddddddddd/content` as const,
      contentType: "image/png" as const, contentByteSize: 8,
      contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", isPrimary: true,
      registeredAt: property.createdAt, availableAt: property.createdAt };
    const ready = { ...property, details: { rooms: 1 }, commercialTerms: {
      kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH",
    }, photos: [primaryPhoto], primaryPhoto } satisfies Property;
    const published: Property = { ...ready, status: "PUBLISHED", publishedAt: "2026-08-27T12:00:00.000Z", canWithdrawFromCatalog: true, updatedAt: "2026-08-27T12:00:00.000Z" };
    const withdrawn: Property = { ...published, status: "WITHDRAWN", withdrawnAt: "2026-08-27T13:00:00.000Z", canWithdrawFromCatalog: false, updatedAt: "2026-08-27T13:00:00.000Z" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/publication`) && init?.method === "PUT") return json(published);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/publication`) && init?.method === "DELETE") return json(withdrawn);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/owners`)) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      if (url.endsWith("/buildings")) return json({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
      return json(ready);
    });
    vi.stubGlobal("fetch", fetchMock); renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByText("Ce bien est prêt à être publié.");
    fireEvent.click(screen.getByRole("button", { name: "Publier le bien" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la publication" }));
    expect(await screen.findByText("Le bien est publié.")).toBeInTheDocument();
    expect(screen.getByText("Ce bien est visible dans le catalogue public.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith(`/v1/properties/${PROPERTY_ID}/publication`) && init?.method === "PUT");
    expect(call?.[1]?.body).toBeUndefined();
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe("Bearer property-test-token");
    fireEvent.click(screen.getByRole("button", { name: "Retirer du catalogue" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Il ne sera plus visible publiquement");
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le retrait" }));
    expect(await screen.findByText("Le bien a été retiré du catalogue.")).toBeInTheDocument();
    expect(screen.getAllByText("Retiré du catalogue")).toHaveLength(3);
    const withdrawalCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith(`/v1/properties/${PROPERTY_ID}/publication`) && init?.method === "DELETE");
    expect(withdrawalCall?.[1]?.body).toBeUndefined();
    expect(new Headers(withdrawalCall?.[1]?.headers).get("authorization")).toBe("Bearer property-test-token");
  });

  it("conserve les informations saisies si la mise à jour fondamentale échoue", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}`) && init?.method === "PUT") return problem(500, "REQUEST_FAILED");
      if (url.endsWith("/owners")) return json([]);
      if (url.includes("/v1/property-owners?")) return json(ownerPage());
      return json(property);
    });
    vi.stubGlobal("fetch", fetchMock); renderPath(`/properties/${PROPERTY_ID}`);
    const title = await screen.findByLabelText("Titre");
    fireEvent.change(title, { target: { value: "Titre à conserver" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les informations" }));
    expect(await screen.findByText(/Une erreur inattendue est survenue/)).toBeInTheDocument();
    expect(title).toHaveValue("Titre à conserver");
  });

  it.each([
    [401, "Votre session n’est plus utilisable"],
    [403, "Vous ne disposez pas de l’autorisation nécessaire"],
    [400, "Certaines informations sont invalides"],
    [500, "Une erreur inattendue est survenue"],
  ])("présente une erreur sûre en français pour HTTP %s", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      status === 401 || status === 403 ? new Response(null, { status }) : problem(status, "REQUEST_FAILED"),
    ));
    renderPath(`/properties/${PROPERTY_ID}`);
    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.queryByText("property-test-token")).not.toBeInTheDocument();
  });

  it("affiche l’état bien introuvable pour 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problem(404, "PROPERTY_NOT_FOUND")));
    renderPath(`/properties/${PROPERTY_ID}`);
    expect(await screen.findByRole("heading", { name: "Bien introuvable" })).toBeInTheDocument();
  });

  it("exige la sélection d’un propriétaire avant toute affectation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => String(input).includes("/v1/property-owners?") ? json(ownerPage()) : String(input).endsWith("/owners") ? json([]) : json(property));
    vi.stubGlobal("fetch", fetchMock);
    renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByRole("heading", { name: property.title });
    fireEvent.change(screen.getByLabelText("Quote-part (%)"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Affecter le propriétaire" }));
    expect(await screen.findByText("Sélectionnez un propriétaire disponible.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/buildings"))).toBe(false);
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/owners") && init?.method === "POST")).toBe(false);
  });

  it("affecte un propriétaire existant avec le bearer token", async () => {
    let ownerships: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/owners`) && init?.method === "POST") {
        ownerships = [{ propertyId: PROPERTY_ID, ownerId: OWNER_ID, ownershipShare: 60, createdAt: property.createdAt }];
        return json(ownerships[0], 201);
      }
      if (url.endsWith(`/v1/properties/${PROPERTY_ID}/owners`)) return json(ownerships);
      if (url.endsWith(`/v1/property-owners/${OWNER_ID}`)) return json({
        ownerType: "INDIVIDUAL", ownerId: OWNER_ID, firstName: "Awa", lastName: "Koné",
        createdAt: property.createdAt, updatedAt: property.updatedAt,
      });
      if (url.includes("/v1/property-owners?")) return json(ownerPage([{
        ownerType: "INDIVIDUAL", ownerId: OWNER_ID, firstName: "Awa", lastName: "Koné",
        createdAt: property.createdAt, updatedAt: property.updatedAt,
      }]));
      return json(property);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByText("Aucun propriétaire n’est encore affecté à ce bien.");
    fireEvent.change(await screen.findByLabelText("Propriétaire"), { target: { value: OWNER_ID } });
    fireEvent.change(screen.getByLabelText("Quote-part (%)"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Affecter le propriétaire" }));
    expect(await screen.findByText("Awa Koné")).toBeInTheDocument();
    const assignCall = fetchMock.mock.calls.find(([input, init]) =>
      String(input).endsWith(`/v1/properties/${PROPERTY_ID}/owners`) && init?.method === "POST");
    expect(new Headers(assignCall?.[1]?.headers).get("authorization")).toBe("Bearer property-test-token");
    expect(JSON.parse(String(assignCall?.[1]?.body))).toEqual({ ownerId: OWNER_ID, ownershipShare: 60 });
  });

  it("gère une recherche sans résultat dans le sélecteur", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/v1/property-owners?")
      ? json(ownerPage()) : String(input).endsWith("/owners") ? json([]) : json(property));
    vi.stubGlobal("fetch", fetchMock); renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByRole("heading", { name: property.title });
    fireEvent.change(screen.getByLabelText("Rechercher dans l’annuaire"), { target: { value: "Introuvable" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByText("Aucun propriétaire ne correspond à cette recherche.")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("search=Introuvable");
  });

  it("affiche une erreur d’autorisation de l’annuaire sans masquer le bien", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("/v1/property-owners?")
      ? new Response(null, { status: 403 }) : String(input).endsWith("/owners") ? json([]) : json(property)));
    renderPath(`/properties/${PROPERTY_ID}`);
    expect(await screen.findByRole("heading", { name: property.title })).toBeInTheDocument();
    expect(await screen.findByText("Vous ne disposez pas de l’autorisation nécessaire pour cette action.")).toBeInTheDocument();
  });
});
