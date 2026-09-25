import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";
import type { PropertyOwner } from "./property-model.js";

const OWNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const individual: PropertyOwner = { ownerType: "INDIVIDUAL", ownerId: OWNER_A, firstName: "Awa", lastName: "Koné", email: "awa@example.test", createdAt: "2026-08-28T10:00:00.000Z", updatedAt: "2026-08-28T10:00:00.000Z" };
const company: PropertyOwner = { ownerType: "LEGAL_ENTITY", ownerId: OWNER_B, legalName: "Lagune Gestion", registrationNumber: "CI-ABJ-42", createdAt: "2026-08-27T10:00:00.000Z", updatedAt: "2026-08-27T10:00:00.000Z" };
const session: Session = { status: "authenticated", user: { name: "Jeanne Test" }, login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined), getAccessToken: vi.fn(async () => "owner-test-token") };

function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" } }); }
function problem(status: number) { return json({ type: "https://api.monpiole.example/problems/test", title: "Erreur", status, code: "REQUEST_FAILED", correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, status); }
function page(items: readonly PropertyOwner[], nextCursor: string | null = null) { return { items, pageInfo: { nextCursor, hasNextPage: nextCursor !== null } }; }
function isPlatformProbe(input: RequestInfo | URL) { return String(input).includes("/v1/authentication/authorization/platform-agency-registration-read"); }
function renderPath(path: string) { return render(<SessionContext value={session}><RouterProvider router={createMemoryRouter(applicationRoutes, { initialEntries: [path] })} /></SessionContext>); }

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("annuaire Web des propriétaires", () => {
  it("affiche le chargement puis l’état vide et l’accès à la création", async () => {
    let resolve!: (response: Response) => void; const pending = new Promise<Response>((done) => { resolve = done; });
    vi.stubGlobal("fetch", vi.fn(() => pending)); renderPath("/proprietaires");
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de l’annuaire");
    resolve(json(page([])));
    expect(await screen.findByRole("heading", { name: "Aucun propriétaire" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Créer un propriétaire" })[0]).toHaveAttribute("href", "/proprietaires/new");
  });

  it("affiche, recherche et pagine sans duplication avec les libellés français", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isPlatformProbe(input)) return new Response(null, { status: 403 });
      if (url.includes("cursor=")) return json(page([individual, company]));
      if (url.includes("search=Introuvable")) return json(page([]));
      return json(page([individual], "opaque+/owner=="));
    });
    vi.stubGlobal("fetch", fetchMock); renderPath("/proprietaires");
    const item = await screen.findByRole("listitem");
    expect(within(item).getByText("Personne physique")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "Consulter Awa Koné" })).toHaveAttribute("href", `/proprietaires/${OWNER_A}`);
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus de propriétaires" }));
    expect(await screen.findByRole("heading", { name: "Lagune Gestion" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Awa Koné" })).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("cursor=opaque%2B%2Fowner%3D%3D"))).toBe(true);
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "Introuvable" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("heading", { name: "Aucun résultat" })).toBeInTheDocument();
  });

  it("conserve les résultats si la page suivante échoue", async () => {
    let ownerRequestCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (isPlatformProbe(input)) return new Response(null, { status: 403 });
      ownerRequestCount += 1;
      return ownerRequestCount === 1
        ? json(page([individual], "next"))
        : problem(500);
    }));
    renderPath("/proprietaires");
    fireEvent.click(await screen.findByRole("button", { name: "Afficher plus de propriétaires" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("déjà affichés restent disponibles");
    expect(screen.getByRole("heading", { name: "Awa Koné" })).toBeInTheDocument();
  });

  it("crée une personne morale avec bearer puis ouvre sa fiche", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return json(company, 201);
      if (String(input).endsWith(`/v1/property-owners/${OWNER_B}`)) return json(company);
      return problem(500);
    });
    vi.stubGlobal("fetch", fetchMock); renderPath("/proprietaires/new");
    fireEvent.change(screen.getByLabelText("Type de propriétaire"), { target: { value: "LEGAL_ENTITY" } });
    fireEvent.change(screen.getByLabelText("Raison sociale"), { target: { value: company.legalName } });
    fireEvent.change(screen.getByLabelText("Numéro d’immatriculation"), { target: { value: company.registrationNumber } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("heading", { name: company.legalName })).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe("Bearer owner-test-token");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ ownerType: "LEGAL_ENTITY", legalName: company.legalName });
  });

  it("consulte et modifie une personne physique sans permettre le changement de type", async () => {
    const updated = { ...individual, firstName: "Aya" };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "PUT" ? json(updated) : json(individual));
    vi.stubGlobal("fetch", fetchMock); renderPath(`/proprietaires/${OWNER_A}`);
    expect(await screen.findByRole("heading", { name: "Awa Koné" })).toBeInTheDocument();
    expect(screen.getByLabelText("Type de propriétaire")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Aya" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Les informations du propriétaire sont à jour.")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")?.[1]?.body))).toMatchObject({ ownerType: "INDIVIDUAL", firstName: "Aya" });
  });

  it("présente une erreur initiale sûre", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problem(500))); renderPath("/proprietaires");
    expect(await screen.findByText(/Une erreur inattendue est survenue/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("list")).not.toBeInTheDocument());
  });
});
