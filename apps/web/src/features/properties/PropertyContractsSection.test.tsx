import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import type { PropertyClientContractApi } from "./property-api.js";
import type { PropertyClient, PropertyContract } from "./property-model.js";
import { PropertyContractsSection } from "./PropertyContractsSection.js";

const PROPERTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTRACT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-09-08T10:00:00.000Z";
const client: PropertyClient = { clientId: CLIENT_ID, displayName: "Awa Koné", email: "awa@example.com", createdAt: NOW, updatedAt: NOW };
const draft: PropertyContract = {
  contractId: CONTRACT_ID, propertyId: PROPERTY_ID, clientId: CLIENT_ID, client,
  contractType: "LEASE", status: "DRAFT", reference: "BAIL-2026-001", startDate: "2026-10-01",
  createdAt: NOW, updatedAt: NOW,
  capabilities: { canUpdate: true, canActivate: true, canEnd: false, canCancel: true },
};

function fakeApi(contracts: readonly PropertyContract[] = []): PropertyClientContractApi {
  return {
    listPropertyClients: vi.fn().mockResolvedValue({ items: [client], pageInfo: { nextCursor: null, hasNextPage: false }, canCreateClient: true }),
    createPropertyClient: vi.fn().mockResolvedValue(client),
    retrievePropertyClient: vi.fn().mockResolvedValue(client),
    listPropertyContracts: vi.fn().mockResolvedValue({ items: contracts, pageInfo: { nextCursor: null, hasNextPage: false }, canCreateContract: true }),
    createPropertyContract: vi.fn().mockImplementation(async (_propertyId, input) => ({ ...draft, ...input })),
    retrievePropertyContract: vi.fn().mockResolvedValue(draft),
    updatePropertyContract: vi.fn().mockImplementation(async (_propertyId, _contractId, input) => ({ ...draft, ...input })),
    activatePropertyContract: vi.fn().mockResolvedValue({ ...draft, status: "ACTIVE", activatedAt: NOW,
      capabilities: { canUpdate: false, canActivate: false, canEnd: true, canCancel: true } }),
    endPropertyContract: vi.fn().mockResolvedValue({ ...draft, status: "ENDED", endDate: "2026-12-31", endedAt: NOW,
      capabilities: { canUpdate: false, canActivate: false, canEnd: false, canCancel: false } }),
    cancelPropertyContract: vi.fn().mockResolvedValue({ ...draft, status: "CANCELLED", cancelledAt: NOW,
      capabilities: { canUpdate: false, canActivate: false, canEnd: false, canCancel: false } }),
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe("Property clients and contracts workspace", () => {
  it("keeps active contracts visible but disables new contract creation", async () => {
    const active = { ...draft, status: "ACTIVE" as const,
      capabilities: { canUpdate: false, canActivate: false, canEnd: true, canCancel: true } };
    render(<PropertyContractsSection propertyId={PROPERTY_ID} api={fakeApi([active])} canView canCreate creationBlocked />);
    expect(screen.getByRole("button", { name: "Nouveau contrat" })).toBeDisabled();
    expect(screen.getByText(/Un bail est déjà actif sur ce bien/)).toBeVisible();
    expect(await screen.findByRole("button", { name: /BAIL-2026-001/ })).toBeInTheDocument();
  });
  it("creates a draft from a reusable client without exposing deletion", async () => {
    const api = fakeApi();
    render(<PropertyContractsSection propertyId={PROPERTY_ID} api={api} canView canCreate />);
    expect(await screen.findByRole("heading", { name: "Aucun contrat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nouveau contrat" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: CLIENT_ID } });
    fireEvent.change(screen.getByLabelText("Référence"), { target: { value: "bail-2026-001" } });
    fireEvent.change(screen.getByLabelText("Date de début"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le contrat" }));
    expect(await screen.findByText("Contrat brouillon créé.")).toBeInTheDocument();
    expect(api.createPropertyContract).toHaveBeenCalledWith(PROPERTY_ID, expect.objectContaining({
      clientId: CLIENT_ID, contractType: "LEASE", reference: "bail-2026-001", startDate: "2026-10-01",
    }));
    expect(screen.queryByRole("button", { name: /supprimer/iu })).not.toBeInTheDocument();
  });

  it("activates through an explicit confirmation and refreshes the lifecycle affordances", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = fakeApi([draft]);
    const changed = vi.fn();
    render(<PropertyContractsSection propertyId={PROPERTY_ID} api={api} canView canCreate onChanged={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: /BAIL-2026-001/ }));
    fireEvent.click(screen.getByRole("button", { name: "Activer" }));
    expect(await screen.findByText("Contrat actif.")).toBeInTheDocument();
    expect(api.activatePropertyContract).toHaveBeenCalledWith(PROPERTY_ID, CONTRACT_ID);
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Activer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer" })).toBeInTheDocument();
  });

  it("renders no contract data or action without the server capability", () => {
    const api = fakeApi([draft]);
    render(<PropertyContractsSection propertyId={PROPERTY_ID} api={api} canView={false} canCreate={false} />);
    expect(screen.getByText("Vous n’avez pas l’autorisation de consulter les contrats de ce bien.")).toBeInTheDocument();
    expect(screen.queryByText("BAIL-2026-001")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nouveau contrat" })).not.toBeInTheDocument();
    expect(api.listPropertyContracts).not.toHaveBeenCalled();
  });

  it("uses native form validation and translates contract API conflicts", async () => {
    const api = fakeApi();
    render(<PropertyContractsSection propertyId={PROPERTY_ID} api={api} canView canCreate />);
    await screen.findByRole("heading", { name: "Aucun contrat" });
    fireEvent.click(screen.getByRole("button", { name: "Nouveau contrat" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: CLIENT_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le contrat" }));
    expect(api.createPropertyContract).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Référence"), { target: { value: "BAIL-2026-001" } });
    vi.mocked(api.createPropertyContract).mockRejectedValueOnce(new ApiProblem({
      type: "conflict", title: "Conflit", status: 409,
      code: "PROPERTY_CONTRACT_REFERENCE_CONFLICT", correlationId: "correlation",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Créer le contrat" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("référence de contrat est déjà utilisée");
  });

  it("ends an active contract and cancels a draft through explicit confirmations", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const active: PropertyContract = {
      ...draft, status: "ACTIVE", activatedAt: NOW,
      capabilities: { canUpdate: false, canActivate: false, canEnd: true, canCancel: true },
    };
    const activeApi = fakeApi([active]);
    const first = render(<PropertyContractsSection propertyId={PROPERTY_ID} api={activeApi} canView canCreate />);
    fireEvent.click(await screen.findByRole("button", { name: /BAIL-2026-001/ }));
    fireEvent.change(screen.getByLabelText("Date de fin"), { target: { value: "2026-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() => expect(activeApi.endPropertyContract).toHaveBeenCalledWith(PROPERTY_ID, CONTRACT_ID, "2026-12-31"));
    first.unmount();

    const draftApi = fakeApi([draft]);
    render(<PropertyContractsSection propertyId={PROPERTY_ID} api={draftApi} canView canCreate />);
    fireEvent.click(await screen.findByRole("button", { name: /BAIL-2026-001/ }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler le contrat" }));
    await waitFor(() => expect(draftApi.cancelPropertyContract).toHaveBeenCalledWith(PROPERTY_ID, CONTRACT_ID));
  });
});
