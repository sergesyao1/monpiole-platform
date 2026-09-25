import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Alert, Button, EmptyState, Field, LoadingState, StatusBadge } from "../../ui/index.js";
import type { PropertyClientContractApi } from "./property-api.js";
import { toPropertyUiError, type PropertyUiError } from "./property-errors.js";
import {
  propertyContractStatusLabels, propertyContractTypeLabels,
  type PropertyClient, type PropertyContract, type PropertyContractInput, type PropertyContractStatus,
} from "./property-model.js";

interface PropertyContractsSectionProps {
  readonly propertyId: string;
  readonly api: PropertyClientContractApi;
  readonly canView: boolean;
  readonly canCreate: boolean;
  readonly creationBlocked?: boolean;
  readonly onChanged?: () => void | Promise<void>;
  readonly onReconnect?: () => void;
}

export function PropertyContractsSection({
  propertyId, api, canView, canCreate, creationBlocked = false, onChanged, onReconnect,
}: Readonly<PropertyContractsSectionProps>) {
  const [contracts, setContracts] = useState<readonly PropertyContract[]>([]);
  const [clients, setClients] = useState<readonly PropertyClient[]>([]);
  const [selected, setSelected] = useState<PropertyContract>();
  const [loading, setLoading] = useState(canView);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showClientCreate, setShowClientCreate] = useState(false);
  const [error, setError] = useState<PropertyUiError>();
  const [success, setSuccess] = useState<string>();

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true); setError(undefined);
    try {
      const [contractPage, clientPage] = await Promise.all([
        api.listPropertyContracts(propertyId), api.listPropertyClients({ limit: 100 }),
      ]);
      setContracts(contractPage.items);
      setClients(clientPage.items);
      setSelected((current) => current === undefined
        ? undefined
        : contractPage.items.find((contract) => contract.contractId === current.contractId));
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setLoading(false); }
  }, [api, canView, propertyId]);

  useEffect(() => { void load(); }, [load]);

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true); setError(undefined); setSuccess(undefined);
    try {
      const created = await api.createPropertyClient({
        displayName: String(values.get("displayName") ?? ""),
        ...optionalString(values, "email"), ...optionalString(values, "phoneNumber"),
      });
      setClients((current) => [created, ...current]);
      setShowClientCreate(false); form.reset(); setSuccess("Client créé et disponible pour ce contrat.");
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    setSaving(true); setError(undefined); setSuccess(undefined);
    try {
      const created = await api.createPropertyContract(propertyId, contractInput(new FormData(form)));
      setContracts((current) => [created, ...current]);
      setSelected(created); setShowCreate(false); form.reset();
      setSuccess("Contrat brouillon créé."); await onChanged?.();
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  async function updateContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || selected === undefined) return;
    setSaving(true); setError(undefined); setSuccess(undefined);
    try {
      const updated = await api.updatePropertyContract(propertyId, selected.contractId, contractInput(new FormData(event.currentTarget)));
      replace(updated); setSuccess("Contrat mis à jour.");
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  async function transition(action: "activate" | "cancel" | "end", endDate?: string) {
    if (saving || selected === undefined) return;
    const label = action === "activate" ? "activer" : action === "cancel" ? "annuler" : "terminer";
    if (!window.confirm(`Confirmer : ${label} ce contrat ?`)) return;
    setSaving(true); setError(undefined); setSuccess(undefined);
    try {
      const updated = action === "activate"
        ? await api.activatePropertyContract(propertyId, selected.contractId)
        : action === "cancel"
          ? await api.cancelPropertyContract(propertyId, selected.contractId)
          : await api.endPropertyContract(propertyId, selected.contractId, endDate ?? "");
      replace(updated); setSuccess(`Contrat ${propertyContractStatusLabels[updated.status].toLowerCase()}.`); await onChanged?.();
    } catch (caught) { setError(toPropertyUiError(caught)); }
    finally { setSaving(false); }
  }

  function replace(updated: PropertyContract) {
    setContracts((current) => current.map((contract) => contract.contractId === updated.contractId ? updated : contract));
    setSelected(updated);
  }

  return (
    <section className="content-panel contract-panel" aria-labelledby="property-contracts-title" aria-busy={loading || saving}>
      <div className="section-heading">
        <div><p className="eyebrow">Relation client</p><h2 id="property-contracts-title">Clients et contrats</h2></div>
        {canCreate && <Button variant="secondary" disabled={creationBlocked} onClick={() => setShowCreate((visible) => !visible)}>Nouveau contrat</Button>}
      </div>
      <p className="form-help">Les contrats documentent la relation commerciale. Ils ne modifient pas automatiquement la disponibilité ou l’occupation du bien.</p>
      {creationBlocked && <Alert tone="warning" title="Nouveau bail indisponible"><p>Un bail est déjà actif sur ce bien ou sur le bâtiment auquel il appartient. Terminez ou résiliez ce bail avant d’en créer un nouveau.</p></Alert>}
      {!canView && <Alert tone="warning" title="Accès limité"><p>Vous n’avez pas l’autorisation de consulter les contrats de ce bien.</p></Alert>}
      {loading && <LoadingState label="Chargement des contrats et des clients…" />}
      {error && <Alert tone="danger" title="Opération impossible"><p>{error.message}</p>{error.kind === "session" && onReconnect && <Button variant="secondary" onClick={onReconnect}>Se reconnecter</Button>}</Alert>}
      {success && <Alert tone="success" title={success} />}

      {canView && !creationBlocked && !loading && showCreate && <form className="compact-form contract-form" onSubmit={createContract}>
        <h3>Créer un contrat brouillon</h3>
        <ContractFields clients={clients} />
        <div className="form-actions"><Button type="submit" loading={saving} loadingLabel="Création…">Créer le contrat</Button><Button variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Button></div>
        {canCreate && <Button variant="subtle" onClick={() => setShowClientCreate((visible) => !visible)}>Créer d’abord un client</Button>}
      </form>}

      {canView && showClientCreate && <form className="compact-form contract-form" onSubmit={createClient}>
        <h3>Nouveau client immobilier</h3>
        <div className="form-grid two-columns">
          <Field label="Nom affiché"><input name="displayName" required maxLength={200} /></Field>
          <Field label="E-mail" optional><input name="email" type="email" maxLength={320} /></Field>
          <Field label="Téléphone" optional><input name="phoneNumber" maxLength={100} /></Field>
        </div>
        <div className="form-actions"><Button type="submit" loading={saving} loadingLabel="Création…">Créer le client</Button><Button variant="secondary" onClick={() => setShowClientCreate(false)}>Annuler</Button></div>
      </form>}

      {canView && !loading && contracts.length === 0 && !showCreate && (
        <EmptyState title="Aucun contrat" description="Créez un premier contrat pour suivre la relation avec un client." />
      )}
      {canView && contracts.length > 0 && <div className="contract-workspace-grid">
        <ul className="contract-list" aria-label="Contrats du bien">
          {contracts.map((contract) => <li key={contract.contractId} className={selected?.contractId === contract.contractId ? "is-selected" : undefined}>
            <button type="button" onClick={() => setSelected(contract)}>
              <span><strong>{contract.reference}</strong><small>{contract.client.displayName} · {propertyContractTypeLabels[contract.contractType]}</small></span>
              <StatusBadge tone={contractStatusTone(contract.status)}>{propertyContractStatusLabels[contract.status]}</StatusBadge>
            </button>
          </li>)}
        </ul>
        {selected && <ContractDetail contract={selected} clients={clients} saving={saving} onUpdate={updateContract} onTransition={transition} />}
      </div>}
    </section>
  );
}

function ContractFields({ clients, contract }: Readonly<{ clients: readonly PropertyClient[]; contract?: PropertyContract }>) {
  return <div className="form-grid two-columns">
    <Field label="Client"><select name="clientId" required defaultValue={contract?.client.clientId ?? ""}><option value="">Sélectionner un client</option>{clients.map((client) => <option key={client.clientId} value={client.clientId}>{client.displayName}</option>)}</select></Field>
    <Field label="Type"><select name="contractType" required defaultValue={contract?.contractType ?? "LEASE"}><option value="LEASE">Bail</option><option value="MANAGEMENT">Mandat de gestion</option><option value="OTHER">Autre contrat</option></select></Field>
    <Field label="Référence"><input name="reference" required maxLength={100} defaultValue={contract?.reference ?? ""} /></Field>
    <Field label="Date de début" optional><input name="startDate" type="date" defaultValue={contract?.startDate ?? ""} /></Field>
    <Field label="Date de fin" optional><input name="endDate" type="date" defaultValue={contract?.endDate ?? ""} /></Field>
    <Field label="Notes" optional><textarea name="notes" maxLength={5000} defaultValue={contract?.notes ?? ""} /></Field>
  </div>;
}

function ContractDetail({ contract, clients, saving, onUpdate, onTransition }: Readonly<{
  contract: PropertyContract; clients: readonly PropertyClient[]; saving: boolean;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onTransition: (action: "activate" | "cancel" | "end", endDate?: string) => void | Promise<void>;
}>) {
  const [endDate, setEndDate] = useState(contract.endDate ?? new Date().toISOString().slice(0, 10));
  return <article className="contract-detail" aria-label={`Contrat ${contract.reference}`}>
    <div className="section-heading"><div><p className="eyebrow">Contrat sélectionné</p><h3>{contract.reference}</h3></div><StatusBadge tone={contractStatusTone(contract.status)}>{propertyContractStatusLabels[contract.status]}</StatusBadge></div>
    <dl className="definition-grid"><div><dt>Client</dt><dd>{contract.client.displayName}</dd></div><div><dt>Type</dt><dd>{propertyContractTypeLabels[contract.contractType]}</dd></div><div><dt>Début</dt><dd>{contract.startDate ?? "Non définie"}</dd></div><div><dt>Fin</dt><dd>{contract.endDate ?? "Non définie"}</dd></div></dl>
    {contract.capabilities.canUpdate && <form className="compact-form" onSubmit={onUpdate}><h4>Modifier le brouillon</h4><ContractFields clients={clients} contract={contract} /><Button type="submit" loading={saving} loadingLabel="Enregistrement…">Enregistrer</Button></form>}
    <div className="contract-actions">
      {contract.capabilities.canActivate && <Button onClick={() => void onTransition("activate")}>Activer</Button>}
      {contract.capabilities.canEnd && <><Field label="Date de fin"><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field><Button onClick={() => void onTransition("end", endDate)} disabled={endDate.length === 0}>Terminer</Button></>}
      {contract.capabilities.canCancel && <Button variant="danger" onClick={() => void onTransition("cancel")}>Annuler le contrat</Button>}
    </div>
    {!contract.capabilities.canUpdate && !contract.capabilities.canActivate && !contract.capabilities.canEnd && !contract.capabilities.canCancel && <p className="muted-status">Aucune action n’est disponible pour ce contrat.</p>}
  </article>;
}

function contractInput(values: FormData): PropertyContractInput {
  return {
    clientId: String(values.get("clientId") ?? ""),
    contractType: String(values.get("contractType") ?? "") as PropertyContractInput["contractType"],
    reference: String(values.get("reference") ?? ""),
    ...optionalString(values, "startDate"), ...optionalString(values, "endDate"), ...optionalString(values, "notes"),
  };
}

function optionalString(values: FormData, key: string): Record<string, string> {
  const value = String(values.get(key) ?? "").trim();
  return value.length === 0 ? {} : { [key]: value };
}

function contractStatusTone(status: PropertyContractStatus): "neutral" | "info" | "success" | "warning" {
  if (status === "ACTIVE") return "success";
  if (status === "ENDED") return "info";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}
