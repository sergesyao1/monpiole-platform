import type { PropertyUiError } from "./property-errors.js";

export function PropertyFeedback({ error, onReconnect }: Readonly<{ error: PropertyUiError; onReconnect?: () => void }>) {
  return (
    <div className={`form-message is-${error.kind}`} role="alert">
      <strong>{error.kind === "forbidden" ? "Accès refusé" : error.kind === "not-found" ? "Bien introuvable" : "Action impossible"}</strong>
      <p>{error.message}</p>
      {error.kind === "session" && onReconnect !== undefined && (
        <button className="secondary-action" type="button" onClick={onReconnect}>Se reconnecter</button>
      )}
    </div>
  );
}
