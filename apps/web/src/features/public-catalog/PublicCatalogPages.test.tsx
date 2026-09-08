import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "../../app/routes.js";

const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_PROPERTY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const property = {
  publicPropertyId: PROPERTY_ID,
  title: "Maison des Lagunes",
  propertyType: "HOUSE",
  transactionType: "SALE",
  structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody" },
  commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000 },
  primaryPhoto: { url: `/v1/public/properties/${PROPERTY_ID}/primary-photo`, contentType: "image/png" },
  publishedAt: "2026-08-31T10:00:00.000Z",
} as const;

function page(items: readonly unknown[], nextCursor: string | null = null) {
  return { items, pageInfo: { nextCursor, hasNextPage: nextCursor !== null } };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" } });
}

function renderRoute(path: string) {
  const router = createMemoryRouter(applicationRoutes, { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}

describe("public Property catalog Web journey", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders loading then French public cards without a bearer", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    expect(screen.getByRole("heading", { name: "Biens publiés" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Biens disponibles" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chargement des biens");
    resolveResponse?.(json(page([property])));
    expect(await screen.findByRole("heading", { name: "Maison des Lagunes" })).toBeInTheDocument();
    expect(screen.getAllByText("Maison")).toHaveLength(2);
    expect(screen.getAllByText("Vente")).toHaveLength(2);
    expect(screen.getByText("Bien autonome")).toBeInTheDocument();
    expect(screen.queryByText("HOUSE")).not.toBeInTheDocument();
    expect(screen.queryByText("SALE")).not.toBeInTheDocument();
    expect(screen.getByAltText("Photo principale de Maison des Lagunes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Consulter le bien/ })).toHaveAttribute("href", `/catalogue/${PROPERTY_ID}`);
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.has("authorization")).toBe(false);
  });

  it("keeps only type and project filters in the URL and public API request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.change(screen.getByLabelText("Type de bien"), { target: { value: "HOUSE" } });
    fireEvent.change(screen.getByLabelText("Projet"), { target: { value: "SALE" } });
    fireEvent.click(screen.getByRole("button", { name: "Afficher la sélection" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(router.state.location.search).toBe("?type=HOUSE&transactionType=SALE");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/v1/public/properties?limit=20&type=HOUSE&transactionType=SALE");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toMatch(/tenant|status|search/iu);
  });

  it("loads another keyset page and deduplicates by publicPropertyId", async () => {
    const second = { ...property, publicPropertyId: OTHER_PROPERTY_ID, title: "Villa des Palmes", primaryPhoto: null };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(page([property], "opaque-cursor")))
      .mockResolvedValueOnce(json(page([property, second])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Maison des Lagunes" });
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de biens" }));
    expect(await screen.findByRole("heading", { name: "Villa des Palmes" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Consulter le bien/ })).toHaveLength(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=opaque-cursor");
    expect(screen.getByRole("img", { name: "Aucune photo disponible pour Villa des Palmes" })).toBeInTheDocument();
  });

  it("shows an empty state without a private creation action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(page([]))));
    renderRoute("/catalogue");
    expect(await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Créer un bien/ })).not.toBeInTheDocument();
  });

  it("shows a safe error and retries", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network secret")).mockResolvedValueOnce(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    expect(await screen.findByRole("heading", { name: "Le catalogue est momentanément indisponible" })).toBeInTheDocument();
    expect(screen.queryByText("network secret")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" })).toBeInTheDocument();
  });

  it("renders the French detail, its accessible placeholder and return navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      ...property,
      primaryPhoto: null,
      gallery: [],
      description: "Une maison ouverte sur le jardin.",
      details: { usableSurfaceSquareMeters: 140, rooms: 5, bedrooms: 3, bathrooms: 2, furnished: false },
    })));
    renderRoute(`/catalogue/${PROPERTY_ID}`);
    expect(await screen.findByRole("heading", { name: "Maison des Lagunes" })).toBeInTheDocument();
    expect(screen.getByText("Une maison ouverte sur le jardin.")).toBeInTheDocument();
    expect(screen.getByText("140 m²")).toBeInTheDocument();
    expect(screen.getByText("Non")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conditions financières" })).toBeInTheDocument();
    expect(screen.getByText("Frais d’agence")).toBeInTheDocument();
    expect(screen.getByText(/^5[\s ]000[\s ]000\s*FCFA$/u)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aucune photo disponible pour Maison des Lagunes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Retour au catalogue/ })).toHaveAttribute("href", "/catalogue");
  });

  it("renders the ordered public gallery from safe media URLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      ...property,
      description: null,
      details: {},
      gallery: [
        { mediaId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", kind: "IMAGE", category: "OTHER", position: 0, isPrimary: true,
          url: `/v1/public/properties/${PROPERTY_ID}/media/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/content`, contentType: "image/png" },
        { mediaId: "ffffffff-ffff-4fff-8fff-ffffffffffff", kind: "IMAGE", category: "OTHER", position: 1, isPrimary: false,
          url: `/v1/public/properties/${PROPERTY_ID}/media/ffffffff-ffff-4fff-8fff-ffffffffffff/content`, contentType: "image/png" },
      ],
    })));
    renderRoute(`/catalogue/${PROPERTY_ID}`);
    const gallery = await screen.findByRole("list", { name: "Galerie de Maison des Lagunes" });
    expect(gallery.querySelectorAll("img")).toHaveLength(2);
    expect(screen.getByAltText("Photo principale 1 de Maison des Lagunes")).toHaveAttribute("src", expect.stringContaining("/media/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/content"));
    expect(screen.getByText("Image principale")).toBeInTheDocument();
  });

  it("renders the same non-disclosing not-found state for a withdrawn or missing public detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      type: "https://api.monpiole.example/problems/public-property-not-found",
      title: "Public Property not found",
      status: 404,
      code: "PUBLIC_PROPERTY_NOT_FOUND",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }, 404)));
    renderRoute(`/catalogue/${OTHER_PROPERTY_ID}`);
    expect(await screen.findByRole("heading", { name: "Bien introuvable" })).toBeInTheDocument();
    expect(screen.getByText("Ce bien n’est pas disponible dans ce catalogue.")).toBeInTheDocument();
    expect(screen.queryByText(/brouillon|tenant|privé/iu)).not.toBeInTheDocument();
  });
});
