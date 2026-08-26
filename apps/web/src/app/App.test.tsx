import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { applicationRoutes } from "./routes.js";

function renderRoute(path = "/") {
  return render(<RouterProvider router={createMemoryRouter(applicationRoutes, { initialEntries: [path] })} />);
}

describe("application web MonPiole", () => {
  it("affiche le shell et l'accueil en français", () => {
    renderRoute();
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bienvenue dans votre espace immobilier" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Biens immobiliers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Propriétaires" })).toBeInTheDocument();
  });

  it("navigue vers un placeholder métier sans simuler la fonctionnalité", async () => {
    renderRoute();
    fireEvent.click(screen.getByRole("link", { name: "Biens immobiliers" }));
    expect(await screen.findByRole("heading", { name: "Vos biens seront réunis ici" })).toBeInTheDocument();
    expect(screen.getByText("Fonctionnalité à venir")).toBeInTheDocument();
  });

  it("affiche une page 404 utile", () => {
    renderRoute("/route-inconnue");
    expect(screen.getByRole("heading", { name: "Cette page n'existe pas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/");
  });
});
