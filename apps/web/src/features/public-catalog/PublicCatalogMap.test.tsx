import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setView = vi.fn();
const fitBounds = vi.fn();
vi.mock("leaflet", () => ({
  divIcon: (options: unknown) => options,
  latLngBounds: (positions: unknown) => positions,
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ title, eventHandlers }: { title: string; eventHandlers: { click(): void } }) => <button type="button" onClick={eventHandlers.click}>{title}</button>,
  useMap: () => ({ setView, fitBounds }),
}));

import { PublicCatalogMap, type PublicCatalogMapMarker } from "./PublicCatalogMap.js";
import type { PublicPropertySummary } from "./public-property-model.js";

function property(id: string, precision: "EXACT" | "APPROXIMATE" | null): PublicPropertySummary {
  return {
    publicPropertyId: id, title: `Bien ${id}`, propertyType: "HOUSE", transactionType: "SALE",
    structuralRole: "STANDALONE", location: { country: "CI", city: "Abidjan", district: "Cocody" },
    publicLocation: precision === null ? null : { latitude: id === "a" ? 5.35 : 6.12, longitude: -4.01, precision },
    commercialTerms: { kind: "SALE", currency: "XOF", salePriceAmountMinor: 350_000 }, primaryPhoto: null,
    publishedAt: "2026-09-30T10:00:00.000Z",
  };
}

function show(markers: readonly PublicCatalogMapMarker[], onSelect = vi.fn()) {
  return { onSelect, ...render(<MemoryRouter><PublicCatalogMap markers={markers} catalogSearch="city=Abidjan" onSelect={onSelect} /></MemoryRouter>) };
}

describe("PublicCatalogMap", () => {
  beforeEach(() => { setView.mockClear(); fitBounds.mockClear(); });

  it("renders exact and approximate markers but never creates one for a null location", () => {
    show([{ property: property("a", "EXACT"), label: "350 000 XOF" }, { property: property("b", "APPROXIMATE"), label: "400 000 XOF" }, { property: property("c", null) }]);
    expect(screen.getByRole("region", { name: "Carte des biens affichés" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Bien a, 350 000 XOF/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Bien b, 400 000 XOF/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Bien c/ })).not.toBeInTheDocument();
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it("uses a generic marker label and a restrained single approximate viewport", () => {
    show([{ property: property("a", "APPROXIMATE") }]);
    expect(screen.getByRole("button", { name: "Bien a, Bien immobilier" })).toBeVisible();
    expect(setView).toHaveBeenCalledWith([5.35, -4.01], 11);
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it("selects a marker and exposes a lightweight canonical detail preview", () => {
    const onSelect = vi.fn();
    const marker = { property: property("a", "APPROXIMATE"), label: "350 000 XOF" };
    const view = show([marker], onSelect);
    fireEvent.click(screen.getByRole("button", { name: /Bien a, 350 000 XOF/ }));
    expect(onSelect).toHaveBeenCalledWith("a");
    const onClearSelection = vi.fn();
    view.rerender(<MemoryRouter><PublicCatalogMap markers={[marker]} selectedPropertyId="a" catalogSearch="city=Abidjan" onSelect={onSelect} onClearSelection={onClearSelection} /></MemoryRouter>);
    expect(screen.getByText("Localisation approximative")).toBeVisible();
    expect(screen.getByRole("link", { name: "Voir le bien" })).toHaveAttribute("href", "/catalogue/a");
    fireEvent.click(screen.getByRole("button", { name: "Fermer l’aperçu" }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("renders a neutral state when no marker is public", () => {
    show([{ property: property("c", null) }]);
    expect(screen.getByRole("status")).toHaveTextContent("Aucune position publique");
    expect(screen.queryByTestId("leaflet-map")).not.toBeInTheDocument();
  });
});
