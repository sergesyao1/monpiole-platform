import type { PublicCurrencyReference } from "./public-property-model.js";

export function majorAmountToMinor(value: string, currency: PublicCurrencyReference): number | undefined {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) return undefined;
  const format = currency.minorUnit === 0
    ? /^\d+$/u
    : new RegExp(`^\\d+(?:\\.\\d{1,${currency.minorUnit}})?$`, "u");
  if (!format.test(normalized)) return undefined;
  const [whole, fraction = ""] = normalized.split(".");
  const digits = `${whole}${fraction.padEnd(currency.minorUnit, "0")}`.replace(/^0+(?=\d)/u, "");
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : undefined;
}

export function minorAmountToMajorInput(amount: number, currency: PublicCurrencyReference): string | undefined {
  if (!Number.isSafeInteger(amount) || amount < 0) return undefined;
  if (currency.minorUnit === 0) return String(amount);
  const padded = String(amount).padStart(currency.minorUnit + 1, "0");
  return `${padded.slice(0, -currency.minorUnit)}.${padded.slice(-currency.minorUnit)}`;
}

export function formatCatalogMoney(amount: number, currency: PublicCurrencyReference): string {
  const input = minorAmountToMajorInput(amount, currency);
  if (input === undefined) return `${amount} ${currency.code}`;
  const [whole, fraction] = input.split(".");
  const grouped = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(whole));
  return `${grouped}${fraction === undefined ? "" : `,${fraction}`} ${currency.code}`;
}
