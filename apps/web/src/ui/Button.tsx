import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "subtle" | "ghost" | "danger";

export function buttonClassName(variant: ButtonVariant = "primary", className?: string) {
  return ["ui-button", `ui-button--${variant}`, className].filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{
  loading?: boolean;
  loadingLabel?: string;
  variant?: ButtonVariant;
  children: ReactNode;
}>;

export function Button({
  children,
  className,
  disabled,
  loading = false,
  loadingLabel = "Traitement en cours…",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={buttonClassName(variant, className)}
      disabled={disabled || loading}
      type={type}
    >
      {loading && <span aria-hidden="true" className="ui-spinner" />}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}
