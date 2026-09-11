import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";

const session: Session = { status: "authenticated", user: { name: "Jeanne" }, login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined), getAccessToken: vi.fn(async () => "token") };
const item = { inquiryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", propertyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", propertyTitle: "Villa Riviera", contactName: "Koffi Jean", stage: "SUBMITTED_APPLICATION", nextAction: "DECIDE_APPLICATION", relevantAt: "2026-09-11T10:00:00.000Z", workspaceAnchor: "property-applications" };

function show(fetcher: typeof fetch) {
  vi.stubGlobal("fetch", fetcher);
  const router = createMemoryRouter(applicationRoutes, { initialEntries: ["/demandes"] });
  render(<SessionContext.Provider value={session}><RouterProvider router={router} /></SessionContext.Provider>);
}

describe("Demandes workspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rend la candidature et oriente vers le bon espace du bien", async () => {
    show(vi.fn(async () => new Response(JSON.stringify({ items: [item], pageInfo: { hasNextPage: false, nextCursor: null } }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch);
    expect(await screen.findByText("Koffi Jean")).toBeVisible();
    expect(screen.getByText("Candidature soumise")).toBeVisible();
    expect(screen.getByText("Étudier la candidature")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ouvrir" })).toHaveAttribute("href", `/properties/${item.propertyId}#property-applications`);
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
