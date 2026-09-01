import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { Alert, Button, EmptyState, Field, PageHeader, StatusBadge } from "./index.js";

describe("UI foundation", () => {
  it("exposes button variants and an accessible loading state", () => {
    const { rerender } = render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole("button", { name: "Supprimer" })).toHaveClass("ui-button--danger");

    rerender(<Button loading loadingLabel="Suppression…">Supprimer</Button>);
    expect(screen.getByRole("button", { name: "Suppression…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Suppression…" })).toHaveAttribute("aria-busy", "true");
  });

  it("connects field help and errors to their control", () => {
    render(<Field error="Champ requis" help="Nom visible par l’équipe" label="Nom"><input /></Field>);
    const input = screen.getByRole("textbox", { name: "Nom" });
    expect(input).toHaveAccessibleDescription("Nom visible par l’équipe Champ requis");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Champ requis");
  });

  it("renders feedback, status and page hierarchy consistently", () => {
    render(
      <MemoryRouter>
        <PageHeader breadcrumbs={[{ label: "Biens", to: "/properties" }, { label: "Maison" }]} title="Maison" />
        <Alert title="Modification enregistrée" tone="success" />
        <StatusBadge tone="success">Disponible</StatusBadge>
        <EmptyState description="Commencez par créer un bien." title="Aucun bien" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Fil d’Ariane" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Maison" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Modification enregistrée");
    expect(screen.getByText("Disponible")).toHaveClass("ui-badge--success");
    expect(screen.getByText("Aucun bien")).toBeInTheDocument();
  });
});
