import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";
import type { PropertyPortfolioItem } from "./property-model.js";

const PROPERTY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPERTY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const firstProperty: PropertyPortfolioItem = {
  propertyId: PROPERTY_A, title: "Maison des Lagunes", description: "Une maison familiale.",
  propertyType: "HOUSE", transactionType: "LONG_TERM_RENTAL", status: "DRAFT", structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue des Jardins" },
  createdAt: "2026-08-27T10:00:00.000Z", updatedAt: "2026-08-27T10:00:00.000Z",
};
const secondProperty: PropertyPortfolioItem = {
  propertyId: PROPERTY_B, title: "Appartement du Plateau", propertyType: "APARTMENT",
  transactionType: "SALE", status: "PUBLISHED", publishedAt: "2026-08-26T12:00:00.000Z", structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Plateau", addressLine: "Avenue Chardy" },
  createdAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z",
};
const withdrawnProperty: PropertyPortfolioItem = {
  ...secondProperty,
  propertyId: PROPERTY_C,
  title: "Villa retirée",
  status: "WITHDRAWN",
  withdrawnAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

const authenticatedSession: Session = {
  status: "authenticated", user: { name: "Jeanne Test" }, login: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined), getAccessToken: vi.fn(async () => "portfolio-test-token"),
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" } });
}

function problem(status: number) {
  return json({ type: "https://api.monpiole.example/problems/test", title: "Erreur", status, code: "REQUEST_FAILED", correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, status);
}

function page(items: readonly PropertyPortfolioItem[], nextCursor: string | null = null) {
  return { items, pageInfo: { nextCursor, hasNextPage: nextCursor !== null } };
}

function renderPortfolio(session: Session = authenticatedSession) {
  const fixtureFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.endsWith("/workspace")) return fixtureFetch(input, init);
    const response = await fixtureFetch(url.slice(0, -"/workspace".length), init);
    if (!response.ok) return response;
    const property = await response.json() as PropertyPortfolioItem;
    return json({
      property: { ...property, canWithdrawFromCatalog: false },
      availability: { propertyId: property.propertyId, source: "DIRECT", structuralRole: "STANDALONE", configured: false, canUpdateAvailability: true },
      publicationReadiness: { ready: false, missingRequirements: ["DETAILS", "COMMERCIAL_TERMS", "PRIMARY_PHOTO", "PHOTO_MINIMUM"] },
      owners: [], composition: { buildingCount: 0, unitCount: 0 },
      contracts: { totalCount: 0, draftCount: 0, activeCount: 0, endedCount: 0, cancelledCount: 0 },
      capabilities: { canUpdateCoreInformation: true, canUpdateDetails: true, canUpdatePricing: true, canUpdateAvailability: true, canManagePhotos: true, canPublish: true, canWithdrawFromCatalog: false, canManageOwners: true, canManageComposition: true, canViewContracts: false, canCreateContract: false },
    });
  });
  return render(<SessionContext value={session}><RouterProvider router={createMemoryRouter(applicationRoutes, { initialEntries: ["/properties"] })} /></SessionContext>);
}

function deferred<ResponseValue>() {
  let resolve!: (value: ResponseValue) => void;
  const promise = new Promise<ResponseValue>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("portefeuille immobilier Web", () => {
  it("affiche le chargement initial puis un portefeuille vide avec accès à la création", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    renderPortfolio();
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de votre portefeuille");
    pending.resolve(json(page([])));
    expect(await screen.findByRole("heading", { name: "Aucun bien à afficher" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Créer un bien" })[0]).toHaveAttribute("href", "/properties/new");
  });

  it("affiche les seules données du contrat avec les libellés français et un lien de détail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(page([firstProperty]))));
    renderPortfolio();
    const item = await screen.findByRole("listitem");
    expect(within(item).getByRole("heading", { name: firstProperty.title })).toBeInTheDocument();
    expect(within(item).getByText("Brouillon")).toBeInTheDocument();
    expect(within(item).getByText("Maison")).toBeInTheDocument();
    expect(within(item).getByText("Location longue durée")).toBeInTheDocument();
    expect(within(item).getByText("Cocody, Abidjan · CI")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: `Consulter ${firstProperty.title}` })).toHaveAttribute("href", `/properties/${PROPERTY_A}`);
    expect(screen.getByText("Tous les biens sont affichés.")).toBeInTheDocument();
  });

  it("navigue du portefeuille vers la fiche existante", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/v1/properties/${PROPERTY_A}/owners`)) return json([]);
      if (url.includes("/v1/property-owners?")) return json({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } });
      if (url.endsWith(`/v1/properties/${PROPERTY_A}`)) return json(firstProperty);
      return json(page([firstProperty]));
    }));
    renderPortfolio();
    fireEvent.click(await screen.findByRole("link", { name: `Consulter ${firstProperty.title}` }));
    expect(await screen.findByRole("heading", { name: firstProperty.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Caractéristiques du bien" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tarification du bien" })).toBeInTheDocument();
  });

  it("charge explicitement la page suivante, conserve le curseur opaque, déduplique et détecte la fin", async () => {
    const nextPage = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes("cursor=")
      ? nextPage.promise
      : json(page([firstProperty], "opaque+/cursor==")));
    vi.stubGlobal("fetch", fetchMock);
    renderPortfolio();
    fireEvent.click(await screen.findByRole("button", { name: "Afficher plus de biens" }));
    expect(screen.getByRole("button", { name: "Chargement…" })).toBeDisabled();
    nextPage.resolve(json(page([firstProperty, secondProperty])));
    expect(await screen.findByRole("heading", { name: secondProperty.title })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: firstProperty.title })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Afficher plus de biens" })).not.toBeInTheDocument();
    expect(screen.getByText("Tous les biens sont affichés.")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=opaque%2B%2Fcursor%3D%3D");
  });

  it("conserve les premiers résultats et permet de retenter après une erreur de page suivante", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(page([firstProperty], "next-cursor")))
      .mockResolvedValueOnce(problem(500))
      .mockResolvedValueOnce(json(page([secondProperty])));
    vi.stubGlobal("fetch", fetchMock);
    renderPortfolio();
    fireEvent.click(await screen.findByRole("button", { name: "Afficher plus de biens" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Les biens déjà affichés restent disponibles");
    expect(screen.getByRole("heading", { name: firstProperty.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de biens" }));
    expect(await screen.findByRole("heading", { name: secondProperty.title })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("présente une erreur initiale sûre et une session expirée selon les conventions existantes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    renderPortfolio();
    expect(await screen.findByText(/Votre session n’est plus utilisable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se reconnecter" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("portfolio-test-token")).not.toBeInTheDocument();
  });

  it("présente une erreur serveur initiale en français sans simuler de résultat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problem(500)));
    renderPortfolio();
    expect(await screen.findByText(/Une erreur inattendue est survenue/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("applique uniquement les filtres publiés et transmet le bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    renderPortfolio();
    await screen.findByRole("heading", { name: "Aucun bien à afficher" });
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "  Lagune  " } });
    fireEvent.change(screen.getByLabelText("Type de bien"), { target: { value: "HOUSE" } });
    fireEvent.change(screen.getByLabelText("Statut"), { target: { value: "DRAFT" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer les filtres" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, options] = fetchMock.mock.calls[1]!;
    expect(String(url)).toContain("/v1/properties?limit=20&status=DRAFT&type=HOUSE&search=Lagune");
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer portfolio-test-token");
    expect(String(url)).not.toContain("tenant");
  });
  it("affiche et filtre le statut publié uniquement avec son libellé français", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([secondProperty])));
    vi.stubGlobal("fetch", fetchMock);
    renderPortfolio();
    expect(await screen.findByText("Publié")).toBeInTheDocument();
    expect(screen.queryByText("PUBLISHED")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Statut"), { target: { value: "PUBLISHED" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer les filtres" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("status=PUBLISHED");
  });

  it("conserve un bien retiré dans le portefeuille et applique son filtre français", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([withdrawnProperty])));
    vi.stubGlobal("fetch", fetchMock);
    renderPortfolio();
    expect(await screen.findByText("Retiré du catalogue")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: withdrawnProperty.title })).toBeInTheDocument();
    expect(screen.queryByText("WITHDRAWN")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Statut"), { target: { value: "WITHDRAWN" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer les filtres" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("status=WITHDRAWN");
  });

  it.each(["loading", "unauthenticated"] as const)("n’appelle pas l’API protégée avec une session %s", async (status) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPortfolio({ ...authenticatedSession, status });
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
