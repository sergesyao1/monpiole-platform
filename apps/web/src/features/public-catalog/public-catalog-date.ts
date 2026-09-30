const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/u;

export function dateInputToUtcInstant(value: string): string | undefined {
  const match = DATE_ONLY.exec(value);
  if (match === null) return undefined;
  const [, year, month, day] = match;
  const instant = `${year}-${month}-${day}T00:00:00.000Z`;
  const timestamp = Date.parse(instant);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === instant ? instant : undefined;
}

export function utcInstantToDateInput(value: string | undefined): string {
  if (value === undefined || !Number.isFinite(Date.parse(value))) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function formatStayInterval(from: string, to: string): string {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${formatter.format(new Date(from))} – ${formatter.format(new Date(to))}`;
}
