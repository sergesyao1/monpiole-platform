import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mapContainer = vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>);
const marker = vi.fn((_props: unknown) => <div data-testid="exact-marker" />);
const circle = vi.fn((_props: unknown) => <div data-testid="approximate-area" />);

vi.mock("react-leaflet", () => ({
  MapContainer: (props: { children: React.ReactNode }) => mapContainer(props),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: (props: unknown) => marker(props),
  Circle: (props: unknown) => circle(props),
}));

import { PublicLocationMap } from "./PublicLocationMap.js";

describe("PublicLocationMap", () => {
  it("uses the supplied exact coordinates unchanged with a closer zoom and marker", () => {
    render(<PublicLocationMap position={{ latitude: 5.336421, longitude: -4.026718, precision: "EXACT" }} label="Maison des Lagunes" />);
    expect(screen.getByRole("region", { name: "Carte de localisation de Maison des Lagunes" })).toBeVisible();
    expect(mapContainer).toHaveBeenLastCalledWith(expect.objectContaining({ center: [5.336421, -4.026718], zoom: 14 }));
    expect(marker).toHaveBeenLastCalledWith(expect.objectContaining({ position: [5.336421, -4.026718], title: "Maison des Lagunes" }));
    expect(screen.queryByTestId("approximate-area")).not.toBeInTheDocument();
  });

  it("uses the supplied approximate coordinates unchanged and renders an area", () => {
    render(<PublicLocationMap position={{ latitude: 5.3419, longitude: -4.0037, precision: "APPROXIMATE" }} label="Maison des Lagunes" />);
    expect(mapContainer).toHaveBeenLastCalledWith(expect.objectContaining({ center: [5.3419, -4.0037], zoom: 11 }));
    expect(circle).toHaveBeenLastCalledWith(expect.objectContaining({ center: [5.3419, -4.0037], radius: 800 }));
    expect(screen.queryByTestId("exact-marker")).not.toBeInTheDocument();
  });
});
