import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionContext, type Session } from "../../auth/session.js";
import { applicationRoutes } from "../../app/routes.js";
import type { Property } from "./property-model.js";

const PROPERTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const property: Property = {
  propertyId: PROPERTY_ID, title: "Maison des Lagunes", description: "Une maison familiale.",
  propertyType: "HOUSE", transactionType: "LONG_TERM_RENTAL", status: "DRAFT",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue des Jardins" },
  createdAt: "2026-08-27T10:00:00.000Z", updatedAt: "2026-08-27T10:00:00.000Z",
};
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
  return render(<SessionContext value={session}><RouterProvider router={createMemoryRouter(applicationRoutes, { initialEntries: [path] })} /></SessionContext>);
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("vertical slice Web Property", () => {
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
    expect(screen.getByText("Maison")).toBeInTheDocument();
    expect(await screen.findByText("Awa Koné")).toBeInTheDocument();
    expect(screen.getByText("60 %")).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Awa Koné — déjà affecté" })).toBeDisabled();
  });

  it("met à jour les détails et les conditions commerciales discriminées", async () => {
    const updated = { ...property, details: { rooms: 4, bedrooms: 3, furnished: true }, commercialTerms: { kind: "LONG_TERM_RENTAL" as const, currency: "XOF", rentAmountMinor: 350000, rentPeriod: "MONTH" as const } };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT") return json(updated);
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
    fireEvent.change(screen.getByLabelText("Loyer mensuel (unité mineure)"), { target: { value: "350000" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les détails" }));
    expect(await screen.findByText("Les informations du bien sont à jour.")).toBeInTheDocument();
    const updateCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      details: { rooms: 4, bedrooms: 3, furnished: false },
      commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 350000, rentPeriod: "MONTH" },
    });
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/v1/property-owners?") ? json(ownerPage()) : String(input).endsWith("/owners") ? json([]) : json(property));
    vi.stubGlobal("fetch", fetchMock);
    renderPath(`/properties/${PROPERTY_ID}`);
    await screen.findByRole("heading", { name: property.title });
    fireEvent.change(screen.getByLabelText("Quote-part (%)"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Affecter le propriétaire" }));
    expect(await screen.findByText("Sélectionnez un propriétaire disponible.")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
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
    const assignCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
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
