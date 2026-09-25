import type { ReactNode } from "react";

export type FeedbackTone = "info" | "success" | "warning" | "danger";

export function Alert({ children, title, tone = "info" }: Readonly<{
  children?: ReactNode;
  title?: ReactNode;
  tone?: FeedbackTone;
}>) {
  const liveRole = tone === "danger" ? "alert" : "status";
  return (
    <div className={`ui-alert ui-alert--${tone}`} role={liveRole}>
      {title !== undefined && <h3>{title}</h3>}
      {children !== undefined && <div className="ui-alert__content">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Chargement en cours…" }: Readonly<{ label?: string }>) {
  return (
    <div aria-live="polite" className="ui-state ui-state--loading" role="status">
      <span aria-hidden="true" className="ui-spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ action, description, title }: Readonly<{
  action?: ReactNode;
  description: ReactNode;
  title: ReactNode;
}>) {
  return (
    <div className="ui-state ui-state--empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {action !== undefined && <div className="ui-state__action">{action}</div>}
    </div>
  );
}
