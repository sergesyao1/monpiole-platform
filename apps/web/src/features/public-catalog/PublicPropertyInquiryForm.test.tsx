import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicPropertyInquiryForm } from "./PublicPropertyInquiryForm.js";

const api = {
  list: vi.fn(),
  retrieve: vi.fn(),
  photoUrl: vi.fn(),
  submitInquiry: vi.fn(async () => ({
    inquiryId: "id",
    receivedAt: "2026-09-09T00:00:00.000Z",
  })),
};

describe("Public Property inquiry form", () => {
  it("submits a contact inquiry without requiring an account", async () => {
    api.submitInquiry.mockClear();

    render(
      <PublicPropertyInquiryForm
        propertyId="property"
        api={api}
        intent="CONTACT"
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Je suis intéressé",
      }),
    ).toBeVisible();

    fireEvent.change(
      screen.getByLabelText("Nom"),
      { target: { value: "Awa Koné" } },
    );

    fireEvent.change(
      screen.getByLabelText("Adresse e-mail"),
      { target: { value: "awa@example.com" } },
    );

    fireEvent.change(
      screen.getByLabelText("Moyen de contact préféré"),
      { target: { value: "EMAIL" } },
    );

    fireEvent.click(screen.getByText(/J’accepte/));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Envoyer ma demande",
      }),
    );

    await waitFor(() =>
      expect(api.submitInquiry).toHaveBeenCalled(),
    );

    expect(api.submitInquiry).toHaveBeenCalledWith(
      "property",
      expect.objectContaining({
        contactName: "Awa Koné",
        email: "awa@example.com",
        intent: "CONTACT",
        preferredContactChannel: "EMAIL",
        consent: true,
      }),
    );

    expect(
      await screen.findByText("Demande envoyée"),
    ).toBeVisible();
  });

  it("submits a viewing request as an inquiry", async () => {
    api.submitInquiry.mockClear();

    render(
      <PublicPropertyInquiryForm
        propertyId="property"
        api={api}
        intent="VIEWING_REQUEST"
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Demander une visite",
      }),
    ).toBeVisible();

    fireEvent.change(
      screen.getByLabelText("Nom"),
      { target: { value: "Koffi Jean" } },
    );

    fireEvent.change(
      screen.getByLabelText("Téléphone"),
      { target: { value: "+2250700000000" } },
    );

    fireEvent.change(
      screen.getByLabelText("Moyen de contact préféré"),
      { target: { value: "SMS" } },
    );

    fireEvent.click(screen.getByText(/J’accepte/));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Envoyer ma demande de visite",
      }),
    );

    await waitFor(() =>
      expect(api.submitInquiry).toHaveBeenCalled(),
    );

    expect(api.submitInquiry).toHaveBeenCalledWith(
      "property",
      expect.objectContaining({
        contactName: "Koffi Jean",
        phoneNumber: "+2250700000000",
        intent: "VIEWING_REQUEST",
        preferredContactChannel: "SMS",
        consent: true,
      }),
    );

    expect(
      await screen.findByText("Demande envoyée"),
    ).toBeVisible();
  });

  it("rejects a preferred SMS channel without a phone number", async () => {
    api.submitInquiry.mockClear();

    render(
      <PublicPropertyInquiryForm
        propertyId="property"
        api={api}
        intent="CONTACT"
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Nom"),
      { target: { value: "Awa Koné" } },
    );

    fireEvent.change(
      screen.getByLabelText("Adresse e-mail"),
      { target: { value: "awa@example.com" } },
    );

    fireEvent.change(
      screen.getByLabelText("Moyen de contact préféré"),
      { target: { value: "SMS" } },
    );

    fireEvent.click(screen.getByText(/J’accepte/));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Envoyer ma demande",
      }),
    );

    expect(
      await screen.findByText("Demande non envoyée"),
    ).toBeVisible();

    expect(api.submitInquiry).not.toHaveBeenCalled();
  });
});