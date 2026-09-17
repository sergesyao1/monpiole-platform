import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";

const unauthenticatedSession: Session = {
  status: "unauthenticated",
  login: async () => undefined,
  logout: async () => undefined,
  getAccessToken: async () => "test-token",
};

describe("public agency registration route", () => {
  it("reste publique et expose la navigation MonPiole", () => {
    const router = createMemoryRouter(applicationRoutes, {
      initialEntries: ["/inscription-agence"],
    });

    render(
      <SessionContext value={unauthenticatedSession}>
        <RouterProvider router={router} />
      </SessionContext>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Inscrire votre agence sur MonPiole",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("navigation", {
        name: "Navigation publique",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Catalogue" }),
    ).toHaveAttribute("href", "/catalogue");

    expect(
      screen.getByRole("link", { name: "Inscrire mon agence" }),
    ).toHaveAttribute("href", "/inscription-agence");

    expect(
      screen.getByRole("link", { name: "Espace de gestion" }),
    ).toHaveAttribute("href", "/connexion");

    expect(
      screen.queryByRole("heading", {
        name: "Connectez-vous à MonPiole",
      }),
    ).not.toBeInTheDocument();
  });
});
