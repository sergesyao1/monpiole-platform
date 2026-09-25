import type { ReactNode } from "react";
import { Link } from "react-router";

export type BreadcrumbItem = Readonly<{ label: string; to?: string }>;

export function Breadcrumbs({ items }: Readonly<{ items: readonly BreadcrumbItem[] }>) {
  return (
    <nav aria-label="Fil d’Ariane" className="ui-breadcrumbs">
      <ol>
        {items.map((item, index) => (
          <li aria-current={index === items.length - 1 ? "page" : undefined} key={`${item.label}-${index}`}>
            {item.to === undefined ? item.label : <Link to={item.to}>{item.label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ actions, breadcrumbs, description, eyebrow, meta, title }: Readonly<{
  actions?: ReactNode;
  breadcrumbs?: readonly BreadcrumbItem[];
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}>) {
  return (
    <header className="ui-page-header">
      {breadcrumbs !== undefined && <Breadcrumbs items={breadcrumbs} />}
      <div className="ui-page-header__row">
        <div>
          {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {description !== undefined && <p className="ui-page-header__description">{description}</p>}
          {meta !== undefined && <div className="ui-page-header__meta">{meta}</div>}
        </div>
        {actions !== undefined && <div className="ui-page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeader({ actions, description, title }: Readonly<{
  actions?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}>) {
  return (
    <header className="ui-section-header">
      <div>
        <h2>{title}</h2>
        {description !== undefined && <p>{description}</p>}
      </div>
      {actions !== undefined && <div className="ui-section-header__actions">{actions}</div>}
    </header>
  );
}
