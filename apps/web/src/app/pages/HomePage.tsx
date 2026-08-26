import { Link } from "react-router";

const sections = [
  {
    title: "Biens immobiliers",
    description: "Préparez votre portefeuille et centralisez les informations de chaque bien.",
    to: "/biens",
    label: "Voir l'espace biens",
  },
  {
    title: "Propriétaires",
    description: "Retrouvez prochainement les personnes physiques et morales que vous accompagnez.",
    to: "/proprietaires",
    label: "Voir l'espace propriétaires",
  },
] as const;

export function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero" aria-labelledby="home-title">
        <div>
          <p className="eyebrow">Tableau de bord</p>
          <h1 id="home-title">Bienvenue dans votre espace immobilier</h1>
          <p className="hero-copy">
            MonPiole pose les bases d'une gestion claire, sécurisée et adaptée à votre organisation.
          </p>
        </div>
        <div className="hero-accent" aria-hidden="true">
          <span>MP</span>
        </div>
      </section>

      <section aria-labelledby="modules-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Navigation</p>
            <h2 id="modules-title">Vos espaces</h2>
          </div>
          <span className="quiet-badge">Fondation active</span>
        </div>
        <div className="card-grid">
          {sections.map((section, index) => (
            <article className="feature-card" key={section.to}>
              <span className="card-number" aria-hidden="true">0{index + 1}</span>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
              <Link to={section.to}>{section.label}<span aria-hidden="true"> →</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="foundation-note" aria-labelledby="foundation-title">
        <div className="note-icon" aria-hidden="true">✓</div>
        <div>
          <h2 id="foundation-title">Une base prête à évoluer</h2>
          <p>Le shell, la navigation, la configuration publique et la frontière API sont en place. Les fonctionnalités métier arriveront par vertical slices dédiés.</p>
        </div>
      </section>
    </div>
  );
}
