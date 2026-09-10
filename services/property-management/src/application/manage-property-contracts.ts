import type { PropertyClient } from "../domain/property-client.js";
import {
  PropertyContract,
  type PropertyContractTerms,
  type PropertyContractType,
  type PropertyContractValues,
} from "../domain/property-contract.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type { PropertyClientRepository } from "./property-client-repository.js";
import { PropertyClientNotFoundError } from "./manage-property-clients.js";
import type {
  PropertyContractCursor,
  PropertyContractRecord,
  PropertyContractRepository,
} from "./property-contract-repository.js";
import type { PropertyRepository } from "./property-repository.js";
import { PropertyNotFoundError } from "./retrieve-property.js";

export const DEFAULT_PROPERTY_CONTRACT_LIMIT = 20;
export const MAX_PROPERTY_CONTRACT_LIMIT = 100;

export interface PropertyContractCapabilities {
  readonly canUpdate: boolean;
  readonly canActivate: boolean;
  readonly canEnd: boolean;
  readonly canCancel: boolean;
}

export interface PropertyContractClientView {
  readonly clientId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly phoneNumber?: string;
}

export type PropertyContractView = Readonly<Omit<PropertyContractValues, "tenantId" | "clientId"> & {
  readonly client: PropertyContractClientView;
  readonly capabilities: PropertyContractCapabilities;
}>;

export interface CreatePropertyContractCommand extends PropertyContractTerms {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly propertyId: string;
}

export interface UpdatePropertyContractCommand extends CreatePropertyContractCommand {
  readonly contractId: string;
}

export interface PropertyContractQuery {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
  readonly contractId: string;
}

export interface ListPropertyContractsQuery {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
  readonly limit?: number;
  readonly cursor?: PropertyContractCursor;
}

export interface ListPropertyContractsResult {
  readonly items: readonly PropertyContractView[];
  readonly nextCursor?: PropertyContractCursor;
  readonly canCreateContract: boolean;
}

export interface PropertyContractLifecycleCommand extends PropertyContractQuery {
  readonly correlationId: string;
}

export interface EndPropertyContractCommand extends PropertyContractLifecycleCommand {
  readonly endDate: string;
}

export interface PropertyContractIdentifierGenerator { generate(): string; }
export interface PropertyContractClock { now(): string; }

export class PropertyContractNotFoundError extends Error {
  readonly code = "PROPERTY_CONTRACT_NOT_FOUND";
  constructor() { super("Property contract not found"); }
}

export class InvalidPropertyContractListQueryError extends Error {
  readonly code = "INVALID_PROPERTY_CONTRACT_LIST_QUERY";
  constructor(readonly field: "limit" | "cursor") { super(`Invalid Property contract list query ${field}`); }
}

export class CreatePropertyContract {
  constructor(
    private readonly contracts: PropertyContractRepository,
    private readonly clients: PropertyClientRepository,
    private readonly properties: PropertyRepository,
    private readonly identifiers: PropertyContractIdentifierGenerator,
    private readonly clock: PropertyContractClock,
  ) {}

  async execute(command: CreatePropertyContractCommand): Promise<PropertyContractView> {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY_CONTRACT");
    const [property, client] = await Promise.all([
      this.properties.findById(tenantId, command.propertyId),
      this.clients.findById(tenantId, command.clientId),
    ]);
    if (property === undefined) throw new PropertyNotFoundError();
    if (client === undefined) throw new PropertyClientNotFoundError();
    const now = this.clock.now();
    const contract = PropertyContract.create({
      contractId: this.identifiers.generate(), tenantId, propertyId: command.propertyId,
      ...toTerms(command), createdAt: now, updatedAt: now,
    }, property.values);
    await this.contracts.save(contract, trace(command));
    return toPropertyContractView({ contract, client }, command.authority);
  }
}

export class ListPropertyContracts {
  constructor(private readonly contracts: PropertyContractRepository) {}

  async execute(query: ListPropertyContractsQuery): Promise<ListPropertyContractsResult> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_CONTRACTS");
    const limit = query.limit ?? DEFAULT_PROPERTY_CONTRACT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PROPERTY_CONTRACT_LIMIT) {
      throw new InvalidPropertyContractListQueryError("limit");
    }
    const page = await this.contracts.list({
      tenantId, propertyId: query.propertyId, limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    });
    if (page === undefined) throw new PropertyNotFoundError();
    return {
      items: page.items.map((record) => toPropertyContractView(record, query.authority)),
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      canCreateContract: query.authority.grants.includes("CREATE_PROPERTY_CONTRACT"),
    };
  }
}

export class RetrievePropertyContract {
  constructor(private readonly contracts: PropertyContractRepository) {}

  async execute(query: PropertyContractQuery): Promise<PropertyContractView> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_CONTRACTS");
    const record = await this.contracts.findById(tenantId, query.propertyId, query.contractId);
    if (record === undefined) throw new PropertyContractNotFoundError();
    return toPropertyContractView(record, query.authority);
  }
}

export class UpdatePropertyContract {
  constructor(
    private readonly contracts: PropertyContractRepository,
    private readonly clients: PropertyClientRepository,
    private readonly properties: PropertyRepository,
    private readonly clock: PropertyContractClock,
  ) {}

  async execute(command: UpdatePropertyContractCommand): Promise<PropertyContractView> {
    const tenantId = authorizedTenant(command.authority, "UPDATE_PROPERTY_CONTRACT");
    const [property, client] = await Promise.all([
      this.properties.findById(tenantId, command.propertyId),
      this.clients.findById(tenantId, command.clientId),
    ]);
    if (property === undefined) throw new PropertyNotFoundError();
    if (client === undefined) throw new PropertyClientNotFoundError();
    const record = await this.contracts.updateAtomically(
      tenantId, command.propertyId, command.contractId,
      (current) => current.update(toTerms(command), property.values, this.clock.now()),
      trace(command),
    );
    if (record === undefined) throw new PropertyContractNotFoundError();
    return toPropertyContractView({ ...record, client }, command.authority);
  }
}

abstract class TransitionPropertyContract {
  constructor(
    protected readonly contracts: PropertyContractRepository,
    protected readonly clock: PropertyContractClock,
  ) {}

  protected async update(
    command: PropertyContractLifecycleCommand,
    transition: (contract: PropertyContract, now: string) => PropertyContract,
  ): Promise<PropertyContractView> {
    const tenantId = authorizedTenant(command.authority, "MANAGE_PROPERTY_CONTRACT_LIFECYCLE");
    const record = await this.contracts.updateAtomically(
      tenantId, command.propertyId, command.contractId,
      (current) => transition(current, this.clock.now()),
      trace(command),
    );
    if (record === undefined) throw new PropertyContractNotFoundError();
    return toPropertyContractView(record, command.authority);
  }
}

export class ActivatePropertyContract extends TransitionPropertyContract {
  execute(command: PropertyContractLifecycleCommand): Promise<PropertyContractView> {
    return this.update(command, (contract, now) => contract.activate(now));
  }
}

export class EndPropertyContract extends TransitionPropertyContract {
  execute(command: EndPropertyContractCommand): Promise<PropertyContractView> {
    return this.update(command, (contract, now) => contract.end(command.endDate, now));
  }
}

export class CancelPropertyContract extends TransitionPropertyContract {
  execute(command: PropertyContractLifecycleCommand): Promise<PropertyContractView> {
    return this.update(command, (contract, now) => contract.cancel(now));
  }
}

function toTerms(input: PropertyContractTerms): PropertyContractTerms {
  return {
    clientId: input.clientId,
    contractType: input.contractType,
    reference: input.reference,
    ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
    ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  };
}

function trace(command: { readonly correlationId: string; readonly authority: PropertyAuthority }) {
  return { correlationId: command.correlationId, actorId: command.authority.actorId };
}

export function toPropertyContractView(record: PropertyContractRecord, authority: PropertyAuthority): PropertyContractView {
  const { tenantId: _tenantId, clientId: _clientId, ...contract } = record.contract.values;
  return {
    ...contract,
    client: clientView(record.client),
    capabilities: capabilities(record.contract, authority),
  };
}

function clientView(client: PropertyClient): PropertyContractClientView {
  return {
    clientId: client.values.clientId,
    displayName: client.values.displayName,
    ...(client.values.email === undefined ? {} : { email: client.values.email }),
    ...(client.values.phoneNumber === undefined ? {} : { phoneNumber: client.values.phoneNumber }),
  };
}

function capabilities(contract: PropertyContract, authority: PropertyAuthority): PropertyContractCapabilities {
  const status = contract.values.status;
  const lifecycle = authority.grants.includes("MANAGE_PROPERTY_CONTRACT_LIFECYCLE");
  return {
    canUpdate: status === "DRAFT" && authority.grants.includes("UPDATE_PROPERTY_CONTRACT"),
    canActivate: status === "DRAFT" && contract.values.startDate !== undefined && lifecycle,
    canEnd: status === "ACTIVE" && lifecycle,
    canCancel: (status === "DRAFT" || status === "ACTIVE") && lifecycle,
  };
}
