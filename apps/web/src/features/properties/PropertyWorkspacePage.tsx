import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PropertyWorkspacePage() {
  const navigate = useNavigate();
  const [propertyId, setPropertyId] = useState("");
  const [error, setError] = useState("");

  function openProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = propertyId.trim();
    if (!UUID_PATTERN.test(normalized)) {
      setError("Saisissez un identifiant de bien valide.");
      return;
    }
    navigate(`/properties/${normalized}`);
  }

  return (
    <div className="page-stack property-workspace">
      <section className="hero property-hero">
        <div>
          <p className="eyebrow">Biens immobiliers</p>
          <h1>Gérez vos biens depuis leur fiche</h1>
          <p className="hero-copy">Créez un bien, renseignez ses caractéristiques et ses conditions commerciales, puis consultez ses propriétaires.</p>
          <Link className="primary-action inline-action" to="/properties/new">Créer un bien</Link>
        </div>
        <div className="hero-accent" aria-hidden="true"><span>⌂</span></div>
      </section>

      <section className="content-panel" aria-labelledby="property-lookup-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Accès direct</p>
            <h2 id="property-lookup-title">Retrouver un bien</h2>
          </div>
        </div>
        <form className="compact-form" onSubmit={openProperty} noValidate>
          <label htmlFor="property-id">Identifiant du bien</label>
          <div className="inline-fields">
            <input id="property-id" name="propertyId" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} placeholder="00000000-0000-4000-8000-000000000000" aria-describedby={error ? "property-id-error" : undefined} />
            <button className="secondary-action" type="submit">Ouvrir la fiche</button>
          </div>
          {error && <p className="field-error" id="property-id-error" role="alert">{error}</p>}
        </form>
      </section>

      <aside className="foundation-note" aria-labelledby="property-list-gap-title">
        <div className="note-icon" aria-hidden="true">i</div>
        <div>
          <h2 id="property-list-gap-title">Liste des biens indisponible</h2>
          <p>L’API actuelle ne fournit pas encore de liste des biens. Conservez l’adresse de la fiche après création ou utilisez son identifiant pour la retrouver.</p>
        </div>
      </aside>
    </div>
  );
}
