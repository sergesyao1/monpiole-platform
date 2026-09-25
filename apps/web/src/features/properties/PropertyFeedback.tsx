import type { PropertyUiError } from "./property-errors.js";
import { Alert, Button } from "../../ui/index.js";

export function PropertyFeedback({ error, onReconnect }: Readonly<{ error: PropertyUiError; onReconnect?: () => void }>) {
  return (
    <Alert tone="danger" title={error.kind === "forbidden" ? "Accès refusé" : error.kind === "not-found" ? "Bien introuvable" : "Action impossible"}>
      <p>{error.message}</p>
      {error.kind === "session" && onReconnect !== undefined && (
        <Button variant="secondary" onClick={onReconnect}>Se reconnecter</Button>
      )}
    </Alert>
  );
}
