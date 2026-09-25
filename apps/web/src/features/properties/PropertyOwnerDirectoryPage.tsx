import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";

import { useSession } from "../../auth/session.js";
import { createPropertyApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import { PropertyFeedback } from "./PropertyFeedback.js";
import { propertyOwnerName, type PropertyOwner } from "./property-model.js";
import { Alert, Button, EmptyState, Field, LoadingState, StatusBadge, buttonClassName } from "../../ui/index.js";

const PAGE_LIMIT = 20;

export function PropertyOwnerDirectoryPage() {
  const session = useSession();
  const api = useMemo(() => createPropertyApi(session), [session]);
  const [items, setItems] = useState<readonly PropertyOwner[]>([]);
  const [search, setSearch] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const [nextError, setNextError] = useState<PropertyUiError>();

  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined); setNextError(undefined);
    void api.listPropertyOwners({ limit: PAGE_LIMIT, ...(search === undefined ? {} : { search }) }).then((page) => {
      if (!active) return;
      setItems(page.items); setNextCursor(page.pageInfo.nextCursor); setHasNextPage(page.pageInfo.hasNextPage);
    }).catch((caught: unknown) => {
      if (!active) return;
      setItems([]); setNextCursor(null); setHasNextPage(false); setError(toPropertyUiError(caught));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, search]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || loadingMore) return;
    const value = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    setSearch(value === "" ? undefined : value);
  }

  async function loadMore() {
    if (loadingMore || !hasNextPage || nextCursor === null) return;
    setLoadingMore(true); setNextError(undefined);
    try {
      const page = await api.listPropertyOwners({ limit: PAGE_LIMIT, cursor: nextCursor, ...(search === undefined ? {} : { search }) });
      setItems((current) => appendUniqueOwners(current, page.items));
      setNextCursor(page.pageInfo.nextCursor); setHasNextPage(page.pageInfo.hasNextPage);
    } catch (caught) { setNextError(toPropertyUiError(caught)); }
    finally { setLoadingMore(false); }
  }

  return (
    <div className="page-stack owner-directory-page">
      <section className="hero">
        <div><p className="eyebrow">Propriétaires</p><h1>Votre annuaire de propriétaires</h1><p className="hero-copy">Retrouvez les personnes physiques et morales de votre espace et gérez leurs coordonnées.</p><Link className={buttonClassName("primary", "inline-action")} to="/proprietaires/new">Créer un propriétaire</Link></div>
        <div className="hero-accent" aria-hidden="true"><span>P</span></div>
      </section>
      <section className="content-panel" aria-labelledby="owner-directory-title" aria-busy={loading || loadingMore}>
        <div className="section-heading"><div><p className="eyebrow">Annuaire privé</p><h2 id="owner-directory-title">Vos propriétaires</h2></div></div>
        <form className="owner-directory-search" role="search" onSubmit={applySearch}>
          <Field label="Rechercher" optional><input name="search" maxLength={100} defaultValue={search ?? ""} placeholder="Nom, raison sociale, immatriculation ou e-mail" /></Field>
          <Button variant="secondary" type="submit" disabled={loading || loadingMore}>Rechercher</Button>
        </form>
        {loading && <LoadingState label="Chargement de l’annuaire…" />}
        {!loading && error && <PropertyFeedback error={error} onReconnect={() => void session.login("/proprietaires")} />}
        {!loading && !error && items.length === 0 && <EmptyState title={search ? "Aucun résultat" : "Aucun propriétaire"} description={search ? "Aucun propriétaire ne correspond à votre recherche." : "Créez votre premier propriétaire pour commencer l’annuaire."} action={!search && <Link className={buttonClassName("primary", "inline-action")} to="/proprietaires/new">Créer un propriétaire</Link>} />}
        {!loading && !error && items.length > 0 && <>
          <ul className="property-portfolio-list">{items.map((owner) => <OwnerCard key={owner.ownerId} owner={owner} />)}</ul>
          {nextError && <Alert tone="danger" title="La page suivante n’a pas pu être chargée."><p>{nextError.message} Les propriétaires déjà affichés restent disponibles.</p></Alert>}
          <div className="portfolio-pagination">{hasNextPage ? <Button variant="secondary" loading={loadingMore} loadingLabel="Chargement…" onClick={() => void loadMore()}>Afficher plus de propriétaires</Button> : <p className="muted-status" role="status">Tous les propriétaires sont affichés.</p>}</div>
        </>}
      </section>
    </div>
  );
}

function OwnerCard({ owner }: Readonly<{ owner: PropertyOwner }>) {
  return <li className="property-portfolio-card owner-card">
    <div className="portfolio-card-heading"><div><StatusBadge tone="info">{owner.ownerType === "INDIVIDUAL" ? "Personne physique" : "Personne morale"}</StatusBadge><h3>{propertyOwnerName(owner)}</h3></div><span className="property-type-mark" aria-hidden="true">{propertyOwnerName(owner).slice(0, 1)}</span></div>
    <dl className="portfolio-metadata"><div><dt>E-mail</dt><dd>{owner.email ?? "Non renseigné"}</dd></div><div><dt>Téléphone</dt><dd>{owner.phoneNumber ?? "Non renseigné"}</dd></div></dl>
    <Link className={buttonClassName("secondary", "inline-action")} to={`/proprietaires/${owner.ownerId}`} aria-label={`Consulter ${propertyOwnerName(owner)}`}>Consulter la fiche</Link>
  </li>;
}

function appendUniqueOwners(current: readonly PropertyOwner[], next: readonly PropertyOwner[]): readonly PropertyOwner[] {
  const known = new Set(current.map((owner) => owner.ownerId));
  return [...current, ...next.filter((owner) => !known.has(owner.ownerId))];
}
