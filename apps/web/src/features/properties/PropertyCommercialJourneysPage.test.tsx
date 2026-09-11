import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";

const session: Session = { status: "authenticated", user: { name: "Jeanne" }, login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined), getAccessToken: vi.fn(async () => "token") };
const item = { inquiryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", propertyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", propertyTitle: "Villa Riviera", contactName: "Koffi Jean", stage: "SUBMITTED_APPLICATION", nextAction: "DECIDE_APPLICATION", relevantAt: "2026-09-11T10:00:00.000Z", workspaceAnchor: "property-applications" };
const inquiryItem = { inquiryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", propertyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", propertyTitle: "Appartement Plateau", contactName: "Awa Koné", stage: "NEW", nextAction: "ACKNOWLEDGE_INQUIRY", relevantAt: "2026-09-11T09:00:00.000Z", workspaceAnchor: "property-inquiries" };

function show(fetcher: typeof fetch) {
  vi.stubGlobal("fetch", fetcher);
  const router = createMemoryRouter(applicationRoutes, { initialEntries: ["/demandes"] });
  render(<SessionContext.Provider value={session}><RouterProvider router={router} /></SessionContext.Provider>);
}

describe("Demandes workspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rend les demandes et candidatures et oriente vers les bonnes sections du bien", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({ items: [inquiryItem, item], pageInfo: { hasNextPage: false, nextCursor: null } }), { status: 200, headers: { "content-type": "application/json" } }));
    show(fetcher as typeof fetch);
    expect(await screen.findByText("Koffi Jean")).toBeVisible();
    expect(screen.getByText("Awa Koné")).toBeVisible();
    expect(screen.getByText("Candidature soumise")).toBeVisible();
    expect(screen.getByText("Étudier la candidature")).toBeVisible();
    const links = screen.getAllByRole("link", { name: "Ouvrir" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", `/properties/${inquiryItem.propertyId}#property-inquiries`);
    expect(links[1]).toHaveAttribute("href", `/properties/${item.propertyId}#property-applications`);
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(/\/v1\/property-commercial-journeys\?limit=20$/u);
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain("/properties/");
  });

  it("affiche l’état vide global sans demander ni signaler un bien", async () => {
    show(vi.fn(async () => new Response(JSON.stringify({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch);
    expect(await screen.findByText("Aucune demande à traiter pour le moment.")).toBeVisible();
    expect(screen.getByText("Les demandes reçues pour vos biens apparaîtront ici.")).toBeVisible();
    expect(screen.queryByText("Bien introuvable")).not.toBeInTheDocument();
  });

  it("ne classe pas une erreur de collection globale comme un bien introuvable", async () => {
    const problem = { type: "https://api.monpiole.example/problems/not-found", title: "Not found", status: 404, code: "INVALID_REQUEST", correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    show(vi.fn(async () => new Response(JSON.stringify(problem), { status: 404, headers: { "content-type": "application/problem+json" } })) as typeof fetch);
    expect(await screen.findByText("Les demandes ne peuvent pas être chargées pour le moment. Réessayez dans quelques instants.")).toBeVisible();
    expect(screen.queryByText("Bien introuvable")).not.toBeInTheDocument();
  });

  it("pagine avec le curseur opaque et conserve les résultats en cas d’échec", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [item], pageInfo: { hasNextPage: true, nextCursor: "opaque.cursor" } }), { status: 200, headers: { "content-type": "application/json" } })).mockRejectedValueOnce(new Error("network"));
    show(fetcher as typeof fetch);
    fireEvent.click(await screen.findByRole("button", { name: "Afficher plus de demandes" }));
    expect(await screen.findByText("Les demandes déjà affichées restent disponibles.")).toBeVisible();
    expect(screen.getByText("Koffi Jean")).toBeVisible();
    await waitFor(() => expect(String(fetcher.mock.calls[1]?.[0])).toContain("cursor=opaque.cursor"));
  });
});
