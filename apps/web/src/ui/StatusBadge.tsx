import type { ReactNode } from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export function StatusBadge({ children, tone = "neutral" }: Readonly<{
  children: ReactNode;
  tone?: StatusTone;
}>) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
