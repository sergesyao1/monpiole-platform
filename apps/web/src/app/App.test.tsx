import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { applicationRoutes } from "./routes.js";
import { SessionContext, type Session } from "../auth/session.js";

const authenticatedSession: Session = {
  status: "authenticated", user: { name: "Jeanne Test" },
  login: async () => undefined, logout: async () => undefined,
  getAccessToken: async () => "test-token",
};

function renderRoute(path = "/", session: Session = authenticatedSession) {
  return render(<SessionContext value={session}><RouterProvider router={createMemoryRouter(applicationRoutes, { initialEntries: [path] })} /></SessionContext>);
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

  it("protège une route lorsque la session est absente", async () => {
    renderRoute("/biens", { ...authenticatedSession, status: "unauthenticated" });
    expect(await screen.findByRole("heading", { name: "Connectez-vous à MonPiole" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vos biens seront réunis ici" })).not.toBeInTheDocument();
  });

  it("attend la restauration de session sans afficher la connexion", () => {
    renderRoute("/biens", { ...authenticatedSession, status: "loading" });
    expect(screen.getByRole("heading", { name: /Chargement de votre espace/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Se connecter" })).not.toBeInTheDocument();
  });

  it("affiche une erreur de restauration explicite", () => {
    renderRoute("/", { ...authenticatedSession, status: "error", error: new Error("failure") });
    expect(screen.getByRole("heading", { name: "La session n’a pas pu être restaurée" })).toBeInTheDocument();
  });
});
