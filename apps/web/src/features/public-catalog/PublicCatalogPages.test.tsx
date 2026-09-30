import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./PublicCatalogMap.js", () => ({
  PublicCatalogMap: ({ markers, selectedPropertyId, onSelect, onClearSelection }: { markers: readonly { property: typeof property; label?: string }[]; selectedPropertyId?: string; onSelect(id: string): void; onClearSelection?(): void }) => (
    <div role="region" aria-label="Carte des biens affichés">
      {markers.filter(({ property: item }) => item.publicLocation !== null).map(({ property: item, label }) => (
        <button type="button" key={item.publicPropertyId} aria-pressed={selectedPropertyId === item.publicPropertyId} onClick={() => onSelect(item.publicPropertyId)}>{item.title} {label}</button>
      ))}
      {selectedPropertyId === undefined ? null : <div><span>Aperçu mobile</span><a href={`/catalogue/${selectedPropertyId}`}>Voir le bien</a><button type="button" onClick={onClearSelection}>Fermer l’aperçu</button></div>}
    </div>
  ),
}));

vi.mock("../maps/PublicLocationMap.js", () => ({
  PublicLocationMap: ({ position, label }: { position: { latitude: number; longitude: number; precision: string }; label: string }) => (
    <div role="region" aria-label={`Carte de localisation de ${label}`}>
      {position.latitude},{position.longitude},{position.precision}
    </div>
  ),
}));

import { applicationRoutes } from "../../app/routes.js";

const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_PROPERTY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const THIRD_PROPERTY_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const currencies = [
  { code: "USD", nameKey: "currency.usd", minorUnit: 2, active: true },
  { code: "XOF", nameKey: "currency.xof", minorUnit: 0, active: true },
] as const;

const property = {
  publicPropertyId: PROPERTY_ID,
  title: "Maison des Lagunes",
  propertyType: "HOUSE",
  transactionType: "SALE",
  structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody" },
  publicLocation: null,
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

function catalogAndCurrencyFetch(catalogResponse: () => Response = () => json(page([]))) {
  return vi.fn(async (input: RequestInfo | URL) => String(input).includes("/v1/reference/currencies")
    ? json({ items: currencies })
    : catalogResponse());
}

function renderRoute(path: string) {
  const router = createMemoryRouter(applicationRoutes, { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}

function useMobileViewport() {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })));
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
    expect(screen.getByText("Bien autonome", { selector: ".public-property-role" })).toBeInTheDocument();
    expect(screen.queryByText("HOUSE")).not.toBeInTheDocument();
    expect(screen.queryByText("SALE")).not.toBeInTheDocument();
    expect(screen.getByAltText("Photo principale de Maison des Lagunes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Consulter le bien/ })).toHaveAttribute("href", `/catalogue/${PROPERTY_ID}`);
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.has("authorization")).toBe(false);
  });

  it("keeps unlocated properties in the list and accumulates located markers across cursor pages", async () => {
    const located = { ...property, publicLocation: { latitude: 5.35, longitude: -4.01, precision: "EXACT" as const } };
    const unlocated = { ...property, publicPropertyId: OTHER_PROPERTY_ID, title: "Bien sans position" };
    const next = { ...located, publicPropertyId: THIRD_PROPERTY_ID, title: "Villa suivante", publicLocation: { latitude: 6.12, longitude: -3.99, precision: "APPROXIMATE" as const } };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(json(page([unlocated, located], "opaque-next"))))
      .mockImplementationOnce(() => Promise.resolve(json(page([next]))));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    expect(await screen.findByRole("heading", { name: "Bien sans position" })).toBeVisible();
    expect(await screen.findByRole("region", { name: "Carte des biens affichés" })).toHaveTextContent(property.title);
    fireEvent.focus(screen.getAllByRole("link", { name: /Consulter le bien/ })[1]!);
    expect(screen.getByRole("button", { name: /Maison des Lagunes/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de biens" }));
    expect(await screen.findByRole("button", { name: /Villa suivante/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Villa suivante" })).toBeVisible();
  });

  it("defaults mobile discovery to List and toggles Map without refetching or losing filters", async () => {
    useMobileViewport();
    const located = { ...property, publicLocation: { latitude: 5.35, longitude: -4.01, precision: "APPROXIMATE" as const } };
    const fetchMock = vi.fn(async () => json(page([located])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue?city=Abidjan&type=HOUSE");
    expect(await screen.findByRole("heading", { name: property.title })).toBeVisible();
    expect(screen.getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Carte" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("region", { name: "Carte des biens affichés" })).not.toBeInTheDocument();
    const requestsBeforeToggle = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Carte" }));
    expect(await screen.findByRole("region", { name: "Carte des biens affichés" })).toHaveTextContent(property.title);
    expect(fetchMock).toHaveBeenCalledTimes(requestsBeforeToggle);
    expect(screen.getByLabelText("Ville")).toHaveValue("Abidjan");
    expect(screen.getByLabelText("Maison")).toBeChecked();
    expect(screen.getByLabelText("Trier les résultats")).toBeVisible();
  });

  it("preserves accumulated pages and selected marker when switching mobile modes", async () => {
    useMobileViewport();
    const first = { ...property, publicLocation: { latitude: 5.35, longitude: -4.01, precision: "EXACT" as const } };
    const second = { ...first, publicPropertyId: OTHER_PROPERTY_ID, title: "Villa mobile", publicLocation: { latitude: 6.12, longitude: -3.99, precision: "APPROXIMATE" as const } };
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(json(page([first], "opaque-mobile"))))
      .mockImplementationOnce(() => Promise.resolve(json(page([second]))));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue?q=lagune");
    expect(await screen.findByRole("heading", { name: property.title })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de biens" }));
    expect(await screen.findByRole("heading", { name: "Villa mobile" })).toBeVisible();
    fireEvent.focus(screen.getAllByRole("link", { name: /Consulter le bien/ })[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Carte" }));
    const map = await screen.findByRole("region", { name: "Carte des biens affichés" });
    expect(map).toHaveTextContent(property.title);
    expect(map).toHaveTextContent("Villa mobile");
    expect(screen.getByRole("button", { name: /Villa mobile/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Aperçu mobile")).toBeVisible();
    expect(screen.getByRole("link", { name: "Voir le bien" })).toHaveAttribute("href", `/catalogue/${OTHER_PROPERTY_ID}`);
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    expect(screen.getByRole("heading", { name: "Villa mobile" }).closest("article")).toHaveClass("is-selected");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps null-location mobile results in List and shows a neutral Map state", async () => {
    useMobileViewport();
    vi.stubGlobal("fetch", vi.fn(async () => json(page([property]))));
    renderRoute("/catalogue");
    expect(await screen.findByRole("heading", { name: property.title })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Carte" }));
    expect(screen.getByRole("status")).toHaveTextContent("Aucune position publique");
    expect(screen.queryByRole("region", { name: "Carte des biens affichés" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    expect(screen.getByRole("heading", { name: property.title })).toBeVisible();
  });

  it("replaces stale mobile markers after canonical sort and filter changes", async () => {
    useMobileViewport();
    const oldResult = { ...property, title: "Ancien résultat", publicLocation: { latitude: 5.35, longitude: -4.01, precision: "EXACT" as const } };
    const sortedResult = { ...oldResult, publicPropertyId: OTHER_PROPERTY_ID, title: "Résultat trié" };
    const filteredResult = { ...oldResult, publicPropertyId: THIRD_PROPERTY_ID, title: "Résultat filtré" };
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(json(page([oldResult]))))
      .mockImplementationOnce(() => Promise.resolve(json(page([sortedResult]))))
      .mockImplementationOnce(() => Promise.resolve(json(page([filteredResult]))));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    expect(await screen.findByRole("heading", { name: "Ancien résultat" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Carte" }));
    expect(await screen.findByRole("button", { name: /Ancien résultat/ })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Trier les résultats"), { target: { value: "PRICE_ASC" } });
    expect(await screen.findByRole("button", { name: /Résultat trié/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Ancien résultat/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Bouaké" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("button", { name: /Résultat filtré/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Résultat trié/ })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("applies one property and transaction type through the canonical request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText("Plus de filtres"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Maison" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Vente" }));
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(router.state.location.search).toBe("?type=HOUSE&transactionType=SALE");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/v1/public/properties?limit=20&type=HOUSE&transactionType=SALE");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toMatch(/tenant|status|search/iu);
  });

  it("applies multiple canonical filters, bedrooms and preserves geography and q", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue?city=Abidjan&q=piscine&cursor=ancien");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText("Plus de filtres"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Location longue durée" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Vente" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Appartement" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Maison" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Unité" }));
    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Maximum"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(router.state.location.search).toContain("transactionType=LONG_TERM_RENTAL%2CSALE"));
    expect(router.state.location.search).toContain("type=APARTMENT%2CHOUSE");
    expect(router.state.location.search).toContain("structuralRole=UNIT");
    expect(router.state.location.search).toContain("minBedrooms=0");
    expect(router.state.location.search).toContain("maxBedrooms=3");
    expect(router.state.location.search).toContain("city=Abidjan");
    expect(router.state.location.search).toContain("q=piscine");
    expect(router.state.location.search).not.toContain("cursor");
  });

  it("restores E3 and E4 controls from a shareable URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(page([]))));
    renderRoute("/catalogue?countryCode=CI&q=studio&type=APARTMENT,HOUSE&transactionType=SHORT_TERM_RENTAL,SALE&structuralRole=STANDALONE,UNIT&minBedrooms=0&maxBedrooms=2");
    expect(await screen.findByLabelText("Pays")).toHaveValue("CI");
    expect(screen.getByLabelText("Recherche")).toHaveValue("studio");
    fireEvent.click(screen.getByText(/Plus de filtres/));
    expect(screen.getByRole("checkbox", { name: "Appartement" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Maison" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Location courte durée" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Vente" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Bien autonome" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Unité" })).toBeChecked();
    expect(screen.getByLabelText("Minimum")).toHaveValue(0);
    expect(screen.getByLabelText("Maximum")).toHaveValue(2);
  });

  it.each([
    ["minBedrooms", "0", "Minimum"],
    ["maxBedrooms", "4", "Maximum"],
  ])("restores %s alone", async (parameter, value, label) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(page([]))));
    renderRoute(`/catalogue?${parameter}=${value}`);
    fireEvent.click(await screen.findByText(/Plus de filtres/));
    expect(screen.getByLabelText(label)).toHaveValue(Number(value));
  });

  it("rejects invalid and reversed bedroom ranges without requesting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText("Plus de filtres"));
    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nombre entier compris entre 0 et 100");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Maximum"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("minimum de chambres doit être inférieur ou égal au maximum");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies XOF minimum zero and preserves E3/E4 criteria with canonical minor amounts", async () => {
    const fetchMock = catalogAndCurrencyFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue?city=Abidjan&q=studio&type=APARTMENT&cursor=ancien");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText(/Plus de filtres/));
    fireEvent.focus(screen.getByLabelText("Devise"));
    await screen.findByRole("option", { name: "XOF" });
    fireEvent.change(screen.getByLabelText("Devise"), { target: { value: "XOF" } });
    fireEvent.change(screen.getByLabelText("Prix minimum"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(router.state.location.search).toContain("minPriceAmountMinor=0"));
    expect(router.state.location.search).toContain("currencyCode=XOF");
    expect(router.state.location.search).toContain("city=Abidjan");
    expect(router.state.location.search).toContain("q=studio");
    expect(router.state.location.search).toContain("type=APARTMENT");
    expect(router.state.location.search).not.toContain("cursor");
  });

  it("converts and applies a bounded USD range without floating-point transport", async () => {
    const fetchMock = catalogAndCurrencyFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText(/Plus de filtres/));
    fireEvent.focus(screen.getByLabelText("Devise"));
    await screen.findByRole("option", { name: "USD" });
    fireEvent.change(screen.getByLabelText("Devise"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("Prix minimum"), { target: { value: "10,50" } });
    fireEvent.change(screen.getByLabelText("Prix maximum"), { target: { value: "20.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(router.state.location.search).toContain("minPriceAmountMinor=1050"));
    expect(router.state.location.search).toContain("maxPriceAmountMinor=2025");
    expect(screen.getByRole("button", { name: "Retirer le filtre Prix min. 10,50 USD" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retirer le filtre Prix max. 20,25 USD" })).toBeVisible();
  });

  it("supports maximum-only and currency-only filters", async () => {
    const fetchMock = catalogAndCurrencyFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText(/Plus de filtres/));
    fireEvent.focus(screen.getByLabelText("Devise"));
    await screen.findByRole("option", { name: "USD" });
    fireEvent.change(screen.getByLabelText("Devise"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("Prix maximum"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(router.state.location.search).toContain("maxPriceAmountMinor=2500"));
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Prix max. 25,00 USD" }));
    await waitFor(() => expect(router.state.location.search).not.toContain("maxPriceAmountMinor"));
    expect(router.state.location.search).toContain("currencyCode=USD");
  });

  it("validates missing currency, malformed amounts and reversed price ranges", async () => {
    const fetchMock = catalogAndCurrencyFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText(/Plus de filtres/));
    fireEvent.change(screen.getByLabelText("Prix minimum"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sélectionnez une devise");
    fireEvent.focus(screen.getByLabelText("Devise"));
    await screen.findByRole("option", { name: "USD" });
    fireEvent.change(screen.getByLabelText("Devise"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("Prix minimum"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("montant positif");
    fireEvent.change(screen.getByLabelText("Prix minimum"), { target: { value: "10.999" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("montant positif");
    fireEvent.change(screen.getByLabelText("Prix minimum"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Prix maximum"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("prix minimum doit être inférieur ou égal");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/v1/public/properties"))).toHaveLength(1);
  });

  it("restores price controls from canonical URL state and removes currency safely", async () => {
    const fetchMock = catalogAndCurrencyFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue?city=Abidjan&currencyCode=USD&minPriceAmountMinor=1050&maxPriceAmountMinor=2025");
    fireEvent.click(await screen.findByText(/Plus de filtres/));
    await waitFor(() => expect(screen.getByLabelText("Devise")).toHaveValue("USD"));
    expect(screen.getByLabelText("Prix minimum")).toHaveValue("10.50");
    expect(screen.getByLabelText("Prix maximum")).toHaveValue("20.25");
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Devise : USD" }));
    await waitFor(() => expect(router.state.location.search).toBe("?city=Abidjan"));
  });

  it("restores price draft state across browser navigation", async () => {
    vi.stubGlobal("fetch", catalogAndCurrencyFetch());
    const { router } = renderRoute("/catalogue?currencyCode=USD&minPriceAmountMinor=1050");
    fireEvent.click(await screen.findByText(/Plus de filtres/));
    await waitFor(() => expect(screen.getByLabelText("Prix minimum")).toHaveValue("10.50"));
    await router.navigate("/catalogue?currencyCode=XOF&maxPriceAmountMinor=150000");
    await waitFor(() => expect(screen.getByLabelText("Devise")).toHaveValue("XOF"));
    expect(screen.getByLabelText("Prix maximum")).toHaveValue("150000");
    await router.navigate(-1);
    await waitFor(() => expect(screen.getByLabelText("Devise")).toHaveValue("USD"));
    expect(screen.getByLabelText("Prix minimum")).toHaveValue("10.50");
  });

  it("keeps canonical price criteria on opaque cursor pagination", async () => {
    let catalogCalls = 0;
    const second = { ...property, publicPropertyId: OTHER_PROPERTY_ID, title: "Villa des Palmes", primaryPhoto: null };
    const fetchMock = catalogAndCurrencyFetch(() => ++catalogCalls === 1
      ? json(page([property], "price-cursor"))
      : json(page([second])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue?currencyCode=XOF&minPriceAmountMinor=100000");
    await screen.findByRole("heading", { name: "Maison des Lagunes" });
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de biens" }));
    expect(await screen.findByRole("heading", { name: "Villa des Palmes" })).toBeVisible();
    const requests = fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes("/v1/public/properties"));
    expect(requests[1]).toContain("cursor=price-cursor");
    expect(requests[1]).toContain("currencyCode=XOF");
    expect(requests[1]).toContain("minPriceAmountMinor=100000");
  });

  it("applies a UTC half-open stay interval and establishes short-term rental intent", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(page([]))));
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue?city=Abidjan&transactionType=SALE,LONG_TERM_RENTAL&cursor=ancien");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText(/Plus de filtres/));
    fireEvent.change(screen.getByLabelText("Arrivée"), { target: { value: "2026-12-10" } });
    fireEvent.change(screen.getByLabelText("Départ"), { target: { value: "2026-12-15" } });
    expect(screen.getByRole("checkbox", { name: "Location courte durée" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Vente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(router.state.location.search).toContain("availableFrom=2026-12-10T00%3A00%3A00.000Z"));
    expect(router.state.location.search).toContain("availableTo=2026-12-15T00%3A00%3A00.000Z");
    expect(router.state.location.search).toContain("transactionType=SHORT_TERM_RENTAL");
    expect(router.state.location.search).toContain("city=Abidjan");
    expect(router.state.location.search).not.toContain("cursor");
  });

  it.each([
    ["2026-12-10", "", "Renseignez une date d’arrivée et une date de départ"],
    ["", "2026-12-15", "Renseignez une date d’arrivée et une date de départ"],
    ["2026-12-10", "2026-12-10", "La date de départ doit être postérieure"],
    ["2026-12-15", "2026-12-10", "La date de départ doit être postérieure"],
  ])("rejects incomplete or unordered stay %s/%s", async (arrival, departure, message) => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(page([]))));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.click(screen.getByText(/Plus de filtres/));
    if (arrival !== "") fireEvent.change(screen.getByLabelText("Arrivée"), { target: { value: arrival } });
    if (departure !== "") fireEvent.change(screen.getByLabelText("Départ"), { target: { value: departure } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("restores and clears a public stay interval while preserving short-term intent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(json(page([])))));
    const { router } = renderRoute("/catalogue?city=Abidjan&transactionType=SHORT_TERM_RENTAL&availableFrom=2026-12-10T00%3A00%3A00.000Z&availableTo=2026-12-15T00%3A00%3A00.000Z");
    fireEvent.click(await screen.findByText(/Plus de filtres/));
    expect(screen.getByLabelText("Arrivée")).toHaveValue("2026-12-10");
    expect(screen.getByLabelText("Départ")).toHaveValue("2026-12-15");
    const stayFilter = screen.getByRole("button", { name: /Retirer le filtre Séjour :/ });
    expect(stayFilter).toHaveTextContent(/10.*15.*2026/u);
    fireEvent.click(stayFilter);
    await waitFor(() => expect(router.state.location.search).not.toContain("availableFrom"));
    expect(router.state.location.search).toContain("transactionType=SHORT_TERM_RENTAL");
    expect(router.state.location.search).toContain("city=Abidjan");
  });

  it("restores stay dates across browser navigation and ignores malformed URL intervals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(json(page([])))));
    const { router } = renderRoute("/catalogue?availableFrom=2026-12-10T00%3A00%3A00.000Z&availableTo=2026-12-15T00%3A00%3A00.000Z");
    fireEvent.click(await screen.findByText(/Plus de filtres/));
    expect(screen.getByLabelText("Arrivée")).toHaveValue("2026-12-10");
    await router.navigate("/catalogue?availableFrom=bad&availableTo=2026-12-20T00%3A00%3A00.000Z");
    await waitFor(() => expect(screen.getByLabelText("Arrivée")).toHaveValue(""));
    expect(screen.getByLabelText("Départ")).toHaveValue("");
    await router.navigate(-1);
    await waitFor(() => expect(screen.getByLabelText("Arrivée")).toHaveValue("2026-12-10"));
  });

  it.each([
    ["NEWEST", ""],
    ["PRICE_ASC", "sort=PRICE_ASC"],
    ["PRICE_DESC", "sort=PRICE_DESC"],
  ])("applies %s sorting through URL and backend", async (sort, expected) => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(page([]))));
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue?city=Abidjan&type=HOUSE&currencyCode=XOF&cursor=ancien&sort=PRICE_DESC");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.change(screen.getByLabelText("Trier les résultats"), { target: { value: sort } });
    await waitFor(() => expect(router.state.location.search.includes("sort=")).toBe(expected !== ""));
    if (expected !== "") expect(router.state.location.search).toContain(expected);
    expect(router.state.location.search).toContain("city=Abidjan");
    expect(router.state.location.search).toContain("type=HOUSE");
    expect(router.state.location.search).toContain("currencyCode=XOF");
    expect(router.state.location.search).not.toContain("cursor");
  });

  it("keeps backend result order and sort on opaque cursor pagination", async () => {
    const second = { ...property, publicPropertyId: OTHER_PROPERTY_ID, title: "Villa des Palmes", primaryPhoto: null };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(json(page([second, property], "sorted-cursor"))))
      .mockImplementationOnce(() => Promise.resolve(json(page([]))));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue?sort=PRICE_ASC&transactionType=SHORT_TERM_RENTAL&availableFrom=2026-12-10T00%3A00%3A00.000Z&availableTo=2026-12-15T00%3A00%3A00.000Z");
    await screen.findByRole("heading", { name: "Villa des Palmes" });
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Villa des Palmes", "Maison des Lagunes"]);
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de biens" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("sort=PRICE_ASC");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=sorted-cursor");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("availableFrom=2026-12-10T00%3A00%3A00.000Z");
  });

  it("removes one active filter while preserving unrelated criteria", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue?city=Abidjan&type=HOUSE,APARTMENT&transactionType=SALE");
    await screen.findByRole("button", { name: "Retirer le filtre Maison" });
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Maison" }));
    await waitFor(() => expect(router.state.location.search).not.toContain("HOUSE"));
    expect(router.state.location.search).toContain("type=APARTMENT");
    expect(router.state.location.search).toContain("transactionType=SALE");
    expect(router.state.location.search).toContain("city=Abidjan");
  });

  it("restores complete geography and text search from a shareable URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue?countryCode=CI&city=Abidjan&commune=Cocody&quartier=Riviera+3&q=villa%20piscine");
    expect(await screen.findByDisplayValue("CI")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Abidjan")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cocody")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Riviera 3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("villa piscine")).toBeInTheDocument();
    await waitFor(() => expect(String(fetchMock.mock.calls[0]?.[0])).toContain("countryCode=CI"));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("commune=Cocody");
    expect(screen.getByRole("button", { name: "Retirer le filtre Pays : CI" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retirer le filtre Recherche : villa piscine" })).toBeVisible();
  });

  it.each([
    ["countryCode", "CI", "Pays"],
    ["city", "Abidjan", "Ville"],
    ["commune", "Cocody", "Commune"],
    ["quartier", "Riviera 3", "Quartier"],
    ["q", "villa piscine", "Recherche"],
  ])("restores %s alone from the URL", async (parameter, value, label) => {
    const fetchMock = vi.fn().mockResolvedValue(json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute(`/catalogue?${parameter}=${encodeURIComponent(value)}`);
    expect(await screen.findByLabelText(label)).toHaveValue(value);
    await waitFor(() => {
      const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), "https://catalogue.monpiole.test");
      expect(requestUrl.searchParams.get(parameter)).toBe(value);
    });
  });

  it("applies criteria then globally clears E3/E4/E5/E6 filters", async () => {
    const fetchMock = catalogAndCurrencyFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderRoute("/catalogue?type=HOUSE&transactionType=SHORT_TERM_RENTAL&currencyCode=XOF&minPriceAmountMinor=100000&availableFrom=2026-12-10T00%3A00%3A00.000Z&availableTo=2026-12-15T00%3A00%3A00.000Z&sort=PRICE_ASC&cursor=stale-cursor");
    await screen.findByRole("heading", { name: "Aucun bien ne correspond à cette sélection" });
    fireEvent.change(screen.getByLabelText("Pays"), { target: { value: "ci" } });
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: " Abidjan " } });
    fireEvent.change(screen.getByLabelText("Commune"), { target: { value: "Cocody" } });
    fireEvent.change(screen.getByLabelText("Quartier"), { target: { value: "Riviera" } });
    fireEvent.change(screen.getByLabelText("Recherche"), { target: { value: " piscine " } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    await waitFor(() => expect(router.state.location.search).toContain("countryCode=CI"));
    expect(router.state.location.search).toContain("type=HOUSE");
    expect(router.state.location.search).toContain("q=piscine");
    expect(router.state.location.search).not.toContain("cursor");
    fireEvent.click(screen.getByRole("button", { name: "Effacer tous les filtres" }));
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(screen.getByRole("checkbox", { name: "Maison" })).not.toBeChecked();
    expect(screen.getByLabelText("Ville")).toHaveValue("");
  });

  it("restores search controls across browser navigation and ignores malformed geography", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(page([]))));
    const { router } = renderRoute("/catalogue?city=Abidjan");
    expect(await screen.findByDisplayValue("Abidjan")).toBeInTheDocument();
    await router.navigate("/catalogue?commune=Cocody&q=studio&type=HOUSE,APARTMENT");
    expect(await screen.findByDisplayValue("Cocody")).toBeInTheDocument();
    expect(screen.getByDisplayValue("studio")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Plus de filtres/));
    expect(screen.getByRole("checkbox", { name: "Maison" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Appartement" })).toBeChecked();
    await router.navigate(-1);
    expect(await screen.findByDisplayValue("Abidjan")).toBeInTheDocument();
    expect(screen.getByLabelText("Commune")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Maison" })).not.toBeChecked();
    await router.navigate("/catalogue?countryCode=INVALID&city=%20%20");
    expect(await screen.findByLabelText("Pays")).toHaveValue("");
  });

  it("loads country suggestions from the public reference source on demand", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/v1/reference/countries")
      ? json({ items: [{ code: "CI", nameKey: "country.ci", active: true }] })
      : json(page([])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue");
    const country = await screen.findByLabelText("Pays");
    fireEvent.focus(country);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/v1/reference/countries"))).toBe(true));
    expect(document.querySelector('#public-country-options option[value="CI"]')).not.toBeNull();
  });

  it("loads another keyset page and deduplicates by publicPropertyId", async () => {
    const second = { ...property, publicPropertyId: OTHER_PROPERTY_ID, title: "Villa des Palmes", primaryPhoto: null };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(page([property], "opaque-cursor")))
      .mockResolvedValueOnce(json(page([property, second])));
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/catalogue?city=Abidjan&type=HOUSE&transactionType=SALE");
    await screen.findByRole("heading", { name: "Maison des Lagunes" });
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de biens" }));
    expect(await screen.findByRole("heading", { name: "Villa des Palmes" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Consulter le bien/ })).toHaveLength(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=opaque-cursor");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("city=Abidjan");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("type=HOUSE");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("transactionType=SALE");
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
      gallery: [], amenities: [],
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
    expect(screen.getByRole("heading", { name: "Localisation" })).toBeInTheDocument();
    expect(screen.getByText("Cocody · Abidjan · CI")).toBeInTheDocument();
    expect(screen.getByText("La position de ce bien n’est pas affichée publiquement.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Carte de localisation/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Retour au catalogue/ })).toHaveAttribute("href", "/catalogue");
  });

  it("renders the exact public position unchanged on the canonical detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      ...property,
      publicLocation: { latitude: 5.336_421, longitude: -4.026_718, precision: "EXACT" },
      gallery: [], amenities: [], description: null, details: {},
    })));
    renderRoute(`/catalogue/${PROPERTY_ID}`);
    const map = await screen.findByRole("region", { name: "Carte de localisation de Maison des Lagunes" });
    expect(map).toHaveTextContent("5.336421,-4.026718,EXACT");
    expect(screen.queryByText("Localisation approximative")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Je suis intéressé" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Demander une visite" })).toBeVisible();
  });

  it("renders an approximate public position unchanged with explicit privacy wording", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      ...property,
      publicLocation: { latitude: 5.341_9, longitude: -4.003_7, precision: "APPROXIMATE" },
      gallery: [], amenities: [], description: null, details: {},
    })));
    renderRoute(`/catalogue/${PROPERTY_ID}`);
    const map = await screen.findByRole("region", { name: "Carte de localisation de Maison des Lagunes" });
    expect(map).toHaveTextContent("5.3419,-4.0037,APPROXIMATE");
    expect(screen.getByText("Localisation approximative")).toBeVisible();
    expect(screen.getByText(/Le repère indique le secteur du bien/)).toBeVisible();
  });

  it("renders the ordered public gallery from safe media URLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      ...property,
      description: null,
      details: {},
      amenities: [{ code: "WIFI", category: "CONNECTIVITY", labelFr: "Wi-Fi", displayOrder: 14 }], gallery: [
        { mediaId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", kind: "IMAGE", category: "OTHER", position: 0, isPrimary: true,
          url: `/v1/public/properties/${PROPERTY_ID}/media/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/content`, contentType: "image/png" },
        { mediaId: "ffffffff-ffff-4fff-8fff-ffffffffffff", kind: "IMAGE", category: "OTHER", position: 1, isPrimary: false,
          url: `/v1/public/properties/${PROPERTY_ID}/media/ffffffff-ffff-4fff-8fff-ffffffffffff/content`, contentType: "image/png" },
      ],
    })));
    renderRoute(`/catalogue/${PROPERTY_ID}`);
    const gallery = await screen.findByRole("list", { name: "Galerie de Maison des Lagunes" });
    expect(screen.getByRole("heading", { name: "Commodités et équipements" })).toBeVisible();
    expect(screen.getByText("Wi-Fi")).toBeVisible();
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
