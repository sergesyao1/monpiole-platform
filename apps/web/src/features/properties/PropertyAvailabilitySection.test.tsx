import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiForbiddenError } from "../../infrastructure/http/api-client.js";
import type { PropertyApi } from "./property-api.js";
import { PropertyAvailabilitySection } from "./PropertyAvailabilitySection.js";
import type { PropertyAvailability } from "./property-model.js";

const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const UPDATED = "2026-09-01T12:00:00.000Z";
const unconfigured: PropertyAvailability = {
  propertyId: PROPERTY_ID, source: "DIRECT", structuralRole: "STANDALONE",
  configured: false, canUpdateAvailability: true,
};
const configured: PropertyAvailability = {
  propertyId: PROPERTY_ID, source: "DIRECT", structuralRole: "UNIT", configured: true,
  availabilityStatus: "AVAILABLE", occupancyStatus: "OCCUPIED", updatedAt: UPDATED,
  canUpdateAvailability: true,
};
const composite: PropertyAvailability = {
  propertyId: PROPERTY_ID, source: "DERIVED_FROM_UNITS", structuralRole: "COMPOSITE",
  availabilityStatus: "AVAILABLE", totalUnitCount: 4, configuredUnitCount: 3,
  availableUnitCount: 1, unavailableUnitCount: 2, vacantUnitCount: 2,
  occupiedUnitCount: 1, unconfiguredUnitCount: 1, canUpdateAvailability: false,
};

function client(initial: PropertyAvailability = unconfigured) {
  return {
    retrievePropertyAvailability: vi.fn().mockResolvedValue(initial),
    updatePropertyAvailability: vi.fn().mockResolvedValue(configured),
  } satisfies Pick<PropertyApi, "retrievePropertyAvailability" | "updatePropertyAvailability">;
}

function show(api = client(), transactionType: "SALE" | "SHORT_TERM_RENTAL" = "SALE") {
  return render(<PropertyAvailabilitySection propertyId={PROPERTY_ID} transactionType={transactionType} api={api} />);
}

describe("Property availability Web", () => {
  it("shows the unconfigured direct state and its French controls", async () => {
    show();
    expect(await screen.findAllByText("Non renseignée")).toHaveLength(2);
    expect(screen.getByLabelText("Disponibilité")).toHaveValue("AVAILABLE");
    expect(screen.getByLabelText("Occupation")).toHaveValue("VACANT");
    expect(screen.getByRole("button", { name: "Enregistrer la disponibilité" })).toBeVisible();
  });

  it("shows persisted direct labels and hides the action without capability", async () => {
    show(client({ ...configured, canUpdateAvailability: false }));
    expect(await screen.findByText("Disponible", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("Occupé", { selector: "dd" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Enregistrer la disponibilité" })).not.toBeInTheDocument();
  });

  it("updates the pair and refreshes the displayed persisted state", async () => {
    const api = client();
    vi.mocked(api.updatePropertyAvailability).mockResolvedValueOnce({
      ...configured, structuralRole: "STANDALONE", availabilityStatus: "UNAVAILABLE", occupancyStatus: "VACANT",
    });
    show(api);
    await screen.findAllByText("Non renseignée");
    fireEvent.change(screen.getByLabelText("Disponibilité"), { target: { value: "UNAVAILABLE" } });
    fireEvent.change(screen.getByLabelText("Occupation"), { target: { value: "VACANT" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la disponibilité" }));
    expect(await screen.findByText("Disponibilité et occupation à jour.")).toBeVisible();
    expect(screen.getByText("Indisponible", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("Libre", { selector: "dd" })).toBeVisible();
    expect(api.updatePropertyAvailability).toHaveBeenCalledWith(PROPERTY_ID, {
      availabilityStatus: "UNAVAILABLE", occupancyStatus: "VACANT",
    });
  });

  it("renders the COMPOSITE summary without a single occupancy or edit form", async () => {
    show(client(composite));
    expect(await screen.findByText(/calculée unité par unité/)).toBeVisible();
    expect(screen.getByText("4", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("3", { selector: "dd" })).toBeVisible();
    expect(screen.getAllByText("1", { selector: "dd" })).toHaveLength(3);
    expect(screen.queryByLabelText("Occupation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer la disponibilité" })).not.toBeInTheDocument();
  });

  it("explains short-term availability without promising a date", async () => {
    show(client(configured), "SHORT_TERM_RENTAL");
    expect(await screen.findByText(/accepte globalement des demandes/)).toBeVisible();
    expect(screen.getByText(/ne garantit aucune date précise/)).toBeVisible();
  });

  it("shows loading, translates permission failures and can retry a network failure", async () => {
    const api = client();
    let resolveFirst: ((value: PropertyAvailability) => void) | undefined;
    vi.mocked(api.retrievePropertyAvailability)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(unconfigured);
    show(api);
    expect(screen.getByRole("status")).toHaveTextContent("Chargement");
    resolveFirst?.(unconfigured);
    await screen.findAllByText("Non renseignée");
    vi.mocked(api.updatePropertyAvailability).mockRejectedValueOnce(new ApiForbiddenError());
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la disponibilité" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("autorisation"));
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(api.retrievePropertyAvailability).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("alert")).toHaveTextContent("erreur inattendue");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findAllByText("Non renseignée")).toHaveLength(2);
  });
});
