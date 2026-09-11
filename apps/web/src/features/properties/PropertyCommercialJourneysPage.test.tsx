import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";

const session: Session = { status: "authenticated", user: { name: "Jeanne" }, login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined), getAccessToken: vi.fn(async () => "token") };
const item = { inquiryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", propertyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", propertyTitle: "Villa Riviera", contactName: "Koffi Jean", stage: "SUBMITTED_APPLICATION", nextAction: "DECIDE_APPLICATION", relevantAt: "2026-09-11T10:00:00.000Z", workspaceAnchor: "property-applications" };
const inquiryItem = { inquiryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", propertyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", propertyTitle: "Appartement Plateau", contactName: "Awa Koné", stage: "NEW_INQUIRY", nextAction: "ACKNOWLEDGE", relevantAt: "2026-09-11T09:00:00.000Z", workspaceAnchor: "property-inquiries" };
const properties = [{ propertyId: item.propertyId, title: item.propertyTitle }, { propertyId: inquiryItem.propertyId, title: inquiryItem.propertyTitle }];
const page = (items: readonly unknown[], nextCursor: string | null = null) => ({ items, totalCount: items.length, properties, pageInfo: { hasNextPage: nextCursor !== null, nextCursor } });

function show(fetcher: typeof fetch, entry = "/demandes") {
  vi.stubGlobal("fetch", fetcher);
  const router = createMemoryRouter(applicationRoutes, { initialEntries: [entry] });
  render(<SessionContext.Provider value={session}><RouterProvider router={router} /></SessionContext.Provider>);
  return router;
}
function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" } }); }

describe("Demandes workspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("affiche les contrôles, le compteur et les destinations des parcours", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => response(page([inquiryItem, item])));
    show(fetcher as typeof fetch);
    expect(await screen.findByText("2 résultats")).toBeVisible();
    expect(screen.getByPlaceholderText("Rechercher un nom, téléphone, email, bien...")).toBeVisible();
    expect(screen.getByLabelText("Bien")).toHaveValue("");
    expect(screen.getByLabelText("Statut")).toHaveValue("");
    expect(screen.getByLabelText("Étape suivante")).toHaveValue("");
    expect(screen.getByLabelText("Trier par")).toHaveValue("RECENT");
    const links = screen.getAllByRole("link", { name: "Ouvrir" });
    expect(links[0]).toHaveAttribute("href", `/properties/${inquiryItem.propertyId}#property-inquiries`);
    expect(links[1]).toHaveAttribute("href", `/properties/${item.propertyId}#property-applications`);
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(/sort=RECENT/u);
  });

  it("applique les filtres dans l’URL, distingue l’état sans résultat et réinitialise", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(page([item]))).mockResolvedValueOnce(response({ ...page([]), totalCount: 0 })).mockResolvedValueOnce(response(page([item])));
    const router = show(fetcher as typeof fetch);
    fireEvent.change(await screen.findByPlaceholderText("Rechercher un nom, téléphone, email, bien..."), { target: { value: "  Traoré  " } });
    fireEvent.change(screen.getByLabelText("Bien"), { target: { value: item.propertyId } });
    fireEvent.change(screen.getByLabelText("Statut"), { target: { value: "SUBMITTED_APPLICATION" } });
    fireEvent.change(screen.getByLabelText("Étape suivante"), { target: { value: "DECIDE_APPLICATION" } });
    fireEvent.change(screen.getByLabelText("Trier par"), { target: { value: "OLDEST" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrer" }));
    expect(await screen.findByText("Aucun résultat ne correspond à vos critères.")).toBeVisible();
    expect(router.state.location.search).toContain("q=Traor%C3%A9");
    await waitFor(() => expect(String(fetcher.mock.calls[1]?.[0])).toContain("stage=SUBMITTED_APPLICATION"));
    fireEvent.click(screen.getAllByRole("button", { name: "Réinitialiser les filtres" })[0]!);
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByText("Koffi Jean")).toBeVisible();
  });

  it("affiche l’état vide global sans demander ni signaler un bien", async () => {
    show(vi.fn(async () => response({ ...page([]), properties: [] })) as typeof fetch);
    expect(await screen.findByText("Aucune demande à traiter pour le moment.")).toBeVisible();
    expect(screen.getByText("Les demandes reçues pour vos biens apparaîtront ici.")).toBeVisible();
    expect(screen.queryByText("Bien introuvable")).not.toBeInTheDocument();
  });

  it("ne classe pas une erreur de collection globale comme un bien introuvable", async () => {
    const problem = { type: "https://api.monpiole.example/problems/not-found", title: "Not found", status: 404, code: "INVALID_REQUEST", correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    show(vi.fn(async () => response(problem, 404)) as typeof fetch);
    expect(await screen.findByText("Les demandes ne peuvent pas être chargées pour le moment. Réessayez dans quelques instants.")).toBeVisible();
    expect(screen.queryByText("Bien introuvable")).not.toBeInTheDocument();
  });

  it("pagine avec le curseur opaque et conserve les résultats en cas d’échec", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ ...page([item], "opaque.cursor"), totalCount: 2 })).mockRejectedValueOnce(new Error("network"));
    show(fetcher as typeof fetch);
    fireEvent.click(await screen.findByRole("button", { name: "Afficher plus de demandes" }));
    expect(await screen.findByText("Les demandes déjà affichées restent disponibles.")).toBeVisible();
    expect(screen.getByText("Koffi Jean")).toBeVisible();
    await waitFor(() => expect(String(fetcher.mock.calls[1]?.[0])).toContain("cursor=opaque.cursor"));
  });
});
