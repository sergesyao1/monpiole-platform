import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { PropertyApi } from "./property-api.js";
import { geolocationInputFromForm, PropertyGeolocationSection } from "./PropertyGeolocationSection.js";

vi.mock("./PropertyGeolocationMap.js", () => ({
  PropertyGeolocationMap: ({ latitude, longitude, onPositionChange }: { latitude: string; longitude: string; onPositionChange: (latitude: number, longitude: number) => void }) => (
    <button type="button" aria-label="Carte de prévisualisation" data-latitude={latitude} data-longitude={longitude} onClick={() => onPositionChange(5.336, -4.027)}>Déplacer le marqueur</button>
  ),
}));

const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PARENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function client(initial: Awaited<ReturnType<PropertyApi["retrievePropertyGeolocation"]>> = { configured: false, source: "OWN" }) {
  return {
    retrievePropertyGeolocation: vi.fn().mockResolvedValue(initial),
    updatePropertyGeolocation: vi.fn().mockResolvedValue({
      configured: true, source: "OWN", latitude: 5.336789, longitude: -4.027123, publicVisibility: "HIDDEN",
    }),
    removePropertyGeolocation: vi.fn().mockResolvedValue(undefined),
  } satisfies Pick<PropertyApi, "retrievePropertyGeolocation" | "updatePropertyGeolocation" | "removePropertyGeolocation">;
}

function show(api = client()) {
  return render(<MemoryRouter><PropertyGeolocationSection propertyId={PROPERTY_ID} api={api} onReconnect={vi.fn()} /></MemoryRouter>);
}

describe("Property geolocation Web", () => {
  it("shows an empty private form with French privacy guidance", async () => {
    show();
    expect(await screen.findByText("Aucune géolocalisation n’est enregistrée pour ce bien.")).toBeVisible();
    expect(screen.getByLabelText("Latitude")).toHaveValue("");
    expect(screen.getByLabelText("Longitude")).toHaveValue("");
    expect(screen.getByLabelText("Visibilité de la position")).toHaveValue("HIDDEN");
    expect(screen.getByText(/La carte permet de prévisualiser/)).toBeVisible();
    expect(screen.getByLabelText("Carte de prévisualisation")).toHaveAttribute("data-latitude", "");
  });

  it("normalizes decimal commas and saves an approximate own position", async () => {
    const api = client(); show(api);
    await screen.findByText("Aucune géolocalisation n’est enregistrée pour ce bien.");
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "5,336789" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-4,027123" } });
    fireEvent.change(screen.getByLabelText("Visibilité de la position"), { target: { value: "APPROXIMATE" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la géolocalisation" }));
    await screen.findByText("Géolocalisation à jour");
    expect(api.updatePropertyGeolocation).toHaveBeenCalledWith(PROPERTY_ID, {
      latitude: 5.336789, longitude: -4.027123, publicVisibility: "APPROXIMATE",
    });
  });

  it("validates bounds and six-decimal precision before any request", async () => {
    const api = client(); show(api);
    await screen.findByText("Aucune géolocalisation n’est enregistrée pour ce bien.");
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "5.1234567" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-4" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la géolocalisation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("six décimales");
    expect(api.updatePropertyGeolocation).not.toHaveBeenCalled();
  });

  it("synchronizes valid fields and a dragged marker without saving automatically", async () => {
    const api = client({ configured: true, source: "OWN", latitude: 5.336789, longitude: -4.027123, publicVisibility: "HIDDEN" });
    show(api);
    const map = await screen.findByLabelText("Carte de prévisualisation");
    expect(map).toHaveAttribute("data-latitude", "5.336789");
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "6.123456" } });
    expect(map).toHaveAttribute("data-latitude", "6.123456");
    fireEvent.click(map);
    expect(screen.getByLabelText("Latitude")).toHaveValue("5.336000");
    expect(screen.getByLabelText("Longitude")).toHaveValue("-4.027000");
    expect(api.updatePropertyGeolocation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la géolocalisation" }));
    await waitFor(() => expect(api.updatePropertyGeolocation).toHaveBeenCalledWith(PROPERTY_ID, { latitude: 5.336, longitude: -4.027, publicVisibility: "HIDDEN" }));
  });

  it("keeps invalid coordinates editable without breaking the map area", async () => {
    show();
    await screen.findByText("Aucune géolocalisation n’est enregistrée pour ce bien.");
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "NaN" } });
    expect(screen.getByLabelText("Latitude")).toHaveValue("NaN");
    expect(screen.getByLabelText("Carte de prévisualisation")).toHaveAttribute("data-latitude", "NaN");
  });

  it("requires confirmation for exact publication intent", async () => {
    const api = client(); const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    show(api); await screen.findByText("Aucune géolocalisation n’est enregistrée pour ce bien.");
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-4" } });
    fireEvent.change(screen.getByLabelText("Visibilité de la position"), { target: { value: "EXACT" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la géolocalisation" }));
    expect(api.updatePropertyGeolocation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la géolocalisation" }));
    await waitFor(() => expect(api.updatePropertyGeolocation).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it("removes an existing own position after confirmation", async () => {
    const api = client({ configured: true, source: "OWN", latitude: 5.336789, longitude: -4.027123, publicVisibility: "HIDDEN" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    show(api);
    const remove = await screen.findByRole("button", { name: "Supprimer la géolocalisation" });
    fireEvent.click(remove);
    await screen.findByText("Géolocalisation à jour");
    expect(api.removePropertyGeolocation).toHaveBeenCalledWith(PROPERTY_ID);
    expect(screen.getByText("Aucune géolocalisation n’est enregistrée pour ce bien.")).toBeVisible();
    confirm.mockRestore();
  });

  it("shows inherited position and offers an explicit override", async () => {
    const api = client({
      configured: true, source: "INHERITED", inheritedFromPropertyId: PARENT_ID,
      latitude: 5.336789, longitude: -4.027123, publicVisibility: "APPROXIMATE",
    });
    show(api);
    expect(await screen.findByText(/Localisation héritée/)).toBeVisible();
    expect(screen.getByText("Position approximative")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Enregistrer la géolocalisation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Définir une localisation propre" }));
    expect(screen.getByRole("button", { name: "Enregistrer la géolocalisation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ouvrir l’ensemble immobilier parent" })).toHaveAttribute("href", `/properties/${PARENT_ID}`);
  });

  it("offers retry after a loading failure", async () => {
    const api = client();
    vi.mocked(api.retrievePropertyGeolocation).mockRejectedValueOnce(new Error("network"));
    show(api);
    expect(await screen.findByRole("alert")).toHaveTextContent("erreur inattendue");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Aucune géolocalisation n’est enregistrée pour ce bien.")).toBeVisible();
    expect(api.retrievePropertyGeolocation).toHaveBeenCalledTimes(2);
  });

  it("exports deterministic form parsing for localized values", () => {
    const form = new FormData();
    form.set("latitude", "-0,000001"); form.set("longitude", "180"); form.set("publicVisibility", "HIDDEN");
    expect(geolocationInputFromForm(form)).toEqual({ latitude: -0.000001, longitude: 180, publicVisibility: "HIDDEN" });
  });
});
