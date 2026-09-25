import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pricingInputFromForm, PropertyPricingForm } from "./PropertyPricingForm.js";
import type { Property } from "./property-model.js";

const baseProperty: Property = {
  propertyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Bien test",
  propertyType: "APARTMENT",
  transactionType: "SHORT_TERM_RENTAL",
  status: "DRAFT",
  canWithdrawFromCatalog: false,
  structuralRole: "STANDALONE",
  location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue test" },
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
};

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("tarification avancée Property", () => {
  it("construit la tarification courte durée complète en XOF", () => {
    expect(pricingInputFromForm(baseProperty, formData({
      rateAmountMinor: "45000",
      pricingUnit: "NIGHT",
      cleaningFeeAmountMinor: "5000",
      securityDepositAmountMinor: "100000",
      minimumStayNights: "3",
    }))).toEqual({
      kind: "SHORT_TERM_RENTAL",
      currency: "XOF",
      rateAmountMinor: 45_000,
      pricingUnit: "NIGHT",
      cleaningFeeAmountMinor: 5_000,
      securityDepositAmountMinor: 100_000,
      minimumStayNights: 3,
    });
  });

  it("construit les frais avancés de location longue durée et de vente", () => {
    expect(pricingInputFromForm({ ...baseProperty, transactionType: "LONG_TERM_RENTAL" }, formData({
      rentAmountMinor: "350000", securityDepositAmountMinor: "700000",
      chargesAmountMinor: "25000", agencyFeeAmountMinor: "350000",
    }))).toEqual({
      kind: "LONG_TERM_RENTAL", currency: "XOF", rentPeriod: "MONTH", rentAmountMinor: 350_000,
      securityDepositAmountMinor: 700_000, chargesAmountMinor: 25_000, agencyFeeAmountMinor: 350_000,
    });
    expect(pricingInputFromForm({ ...baseProperty, transactionType: "SALE" }, formData({
      salePriceAmountMinor: "125000000", agencyFeeAmountMinor: "5000000",
    }))).toEqual({
      kind: "SALE", currency: "XOF", salePriceAmountMinor: 125_000_000, agencyFeeAmountMinor: 5_000_000,
    });
  });

  it("signale une tarification legacy sans la convertir silencieusement", () => {
    render(<PropertyPricingForm property={{ ...baseProperty, commercialTerms: {
      kind: "SHORT_TERM_RENTAL", currency: "EUR", rateAmountMinor: 0, pricingUnit: "NIGHT",
    } }} saving={false} onSave={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Tarification historique" })).toBeInTheDocument();
    expect(screen.getByLabelText("Devise")).toHaveValue("XOF");
    expect(screen.getByLabelText("Tarif (FCFA)")).toHaveValue(null);
  });

  it("soumet la tarification stricte et neutralise le formulaire pendant l'enregistrement", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<PropertyPricingForm property={baseProperty} saving={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Tarif (FCFA)"), { target: { value: "45000" } });
    fireEvent.change(screen.getByLabelText("Frais de ménage (FCFA)"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Durée minimale (nuits)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la tarification" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 45_000,
      cleaningFeeAmountMinor: 5_000, minimumStayNights: 2,
    }));

    rerender(<PropertyPricingForm property={baseProperty} saving onSave={onSave} />);
    expect(screen.getByRole("group", { name: /Tarification/ })).toBeDisabled();
  });
});
