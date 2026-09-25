import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgencyRegistrationForm } from "./AgencyRegistrationForm.js";
import type { AgencyRegistrationApi } from "./agency-registration-api.js";

function createApi(): AgencyRegistrationApi {
  return {
    uploadDocument: vi.fn(async () => ({
      uploadId: "11111111-1111-4111-8111-111111111111",
      originalFilename: "registre-commerce.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expiresAt: "2026-09-18T12:00:00.000Z",
    })),
    submitRegistration: vi.fn(async () => ({
      registrationId: "22222222-2222-4222-8222-222222222222",
      status: "SUBMITTED" as const,
      submittedAt: "2026-09-17T12:00:00.000Z",
    })),
  };
}

describe("AgencyRegistrationForm", () => {
  it("upload le justificatif puis soumet le contrat canonique", async () => {
    const api = createApi();

    render(<AgencyRegistrationForm api={api} />);

    fireEvent.change(screen.getByLabelText("Raison sociale"), {
      target: { value: "Agence Ivoire Immobilier" },
    });
    fireEvent.change(screen.getByLabelText("Nom commercial"), {
      target: { value: "A2I" },
    });
    fireEvent.change(screen.getByLabelText("Numéro d'immatriculation"), {
      target: { value: "CI-ABJ-2026-B-12345" },
    });
    fireEvent.change(screen.getByLabelText("Identifiant fiscal"), {
      target: { value: "CC-1234567" },
    });
    fireEvent.change(screen.getByLabelText("Téléphone de l'agence"), {
      target: { value: "+2250102030405" },
    });
    fireEvent.change(screen.getByLabelText("E-mail de l'agence"), {
      target: { value: "contact@a2i.example" },
    });
    fireEvent.change(screen.getByLabelText("Site web"), {
      target: { value: "https://a2i.example" },
    });
    fireEvent.change(screen.getByLabelText("Adresse"), {
      target: { value: "Cocody Riviera" },
    });
    fireEvent.change(screen.getByLabelText("Ville"), {
      target: { value: "Abidjan" },
    });
    fireEvent.change(screen.getByLabelText("Prénom"), {
      target: { value: "Awa" },
    });
    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Kone" },
    });
    fireEvent.change(screen.getByLabelText("E-mail du contact"), {
      target: { value: "awa@a2i.example" },
    });
    fireEvent.change(screen.getByLabelText("Téléphone du contact"), {
      target: { value: "+2250506070809" },
    });

    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
      "registre-commerce.pdf",
      { type: "application/pdf" },
    );

    fireEvent.change(
      screen.getByLabelText("Justificatif d'immatriculation"),
      { target: { files: [file] } },
    );

    const confirmation = screen.getByRole("checkbox", {
      name: /Je confirme que les informations transmises/,
    });

    fireEvent.click(confirmation);

    expect(confirmation).toBeChecked();

    const submitButton = screen.getByRole("button", {
      name: "Envoyer la demande d'inscription",
    });

    const form = submitButton.closest("form");

    if (form === null) {
      throw new Error("Registration form not found.");
    }

    fireEvent.submit(form);

    await waitFor(() =>
      expect(api.uploadDocument).toHaveBeenCalledWith(file),
    );

    await waitFor(() =>
      expect(api.submitRegistration).toHaveBeenCalledWith({
        agencyLegalName: "Agence Ivoire Immobilier",
        agencyTradeName: "A2I",
        registrationNumber: "CI-ABJ-2026-B-12345",
        taxIdentifier: "CC-1234567",
        phone: "+2250102030405",
        email: "contact@a2i.example",
        website: "https://a2i.example",
        address: "Cocody Riviera",
        city: "Abidjan",
        countryCode: "CI",
        contactFirstName: "Awa",
        contactLastName: "Kone",
        contactEmail: "awa@a2i.example",
        contactPhone: "+2250506070809",
        documents: [
          {
            documentType: "REGISTRATION_CERTIFICATE",
            uploadId: "11111111-1111-4111-8111-111111111111",
          },
        ],
      }),
    );

    expect(
      await screen.findByText(
        "Votre demande d'inscription a bien été transmise",
      ),
    ).toBeVisible();

    expect(
      screen.getByText("22222222-2222-4222-8222-222222222222"),
    ).toBeVisible();
  });

  it("refuse un type de fichier non supporté avant l'upload", async () => {
    const api = createApi();

    render(<AgencyRegistrationForm api={api} />);

    const file = new File(
      ["texte"],
      "document.txt",
      { type: "text/plain" },
    );

    fireEvent.change(
      screen.getByLabelText("Justificatif d'immatriculation"),
      { target: { files: [file] } },
    );

    const form = screen
      .getByRole("button", { name: "Envoyer la demande d'inscription" })
      .closest("form");

    if (form === null) throw new Error("Registration form not found.");

    fireEvent.submit(form);

    expect(
      await screen.findByText(
        "Le justificatif doit être un fichier PDF ou JPEG.",
      ),
    ).toBeVisible();

    expect(api.uploadDocument).not.toHaveBeenCalled();
    expect(api.submitRegistration).not.toHaveBeenCalled();
  });
});
