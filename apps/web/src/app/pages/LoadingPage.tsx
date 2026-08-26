export function LoadingPage() {
  return (
    <main className="standalone-state" aria-live="polite" aria-busy="true">
      <span className="loading-indicator" aria-hidden="true" />
      <h1>Chargement de votre espace…</h1>
      <p>MonPiole prépare l'interface.</p>
    </main>
  );
}
