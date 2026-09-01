import { StatusBadge } from "../../ui/index.js";

interface PlaceholderPageProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <section className="empty-state" aria-labelledby="placeholder-title">
      <div className="empty-state-mark" aria-hidden="true">⌂</div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="placeholder-title">{title}</h1>
      <p>{description}</p>
      <StatusBadge tone="info">Fonctionnalité à venir</StatusBadge>
    </section>
  );
}
