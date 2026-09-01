import { LoadingState } from "../../ui/index.js";

export function LoadingPage() {
  return (
    <main className="standalone-state" aria-live="polite" aria-busy="true">
      <h1>Chargement de votre espace…</h1>
      <LoadingState label="MonPiole prépare l'interface…" />
    </main>
  );
}
