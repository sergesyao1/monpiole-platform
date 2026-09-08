import { PropertyClient, type PropertyClientValues } from "../domain/property-client.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";
import type {
  PropertyClientDirectoryCursor,
  PropertyClientDirectoryPage,
  PropertyClientRepository,
} from "./property-client-repository.js";

export const DEFAULT_PROPERTY_CLIENT_DIRECTORY_LIMIT = 20;
export const MAX_PROPERTY_CLIENT_DIRECTORY_LIMIT = 100;
export const MAX_PROPERTY_CLIENT_DIRECTORY_SEARCH_LENGTH = 100;

export type PropertyClientView = Readonly<Omit<PropertyClientValues, "tenantId">>;

export interface CreatePropertyClientCommand {
  readonly authority: PropertyAuthority;
  readonly correlationId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly phoneNumber?: string;
}

export interface ListPropertyClientsQuery {
  readonly authority: PropertyAuthority;
  readonly limit?: number;
  readonly cursor?: PropertyClientDirectoryCursor;
  readonly search?: string;
}

export interface ListPropertyClientsResult {
  readonly items: readonly PropertyClientView[];
  readonly nextCursor?: PropertyClientDirectoryCursor;
  readonly canCreateClient: boolean;
}

export interface RetrievePropertyClientQuery {
  readonly authority: PropertyAuthority;
  readonly clientId: string;
}

export interface PropertyClientIdentifierGenerator { generate(): string; }
export interface PropertyClientClock { now(): string; }

export class PropertyClientNotFoundError extends Error {
  readonly code = "PROPERTY_CLIENT_NOT_FOUND";
  constructor() { super("Property client not found"); }
}

export class InvalidPropertyClientDirectoryQueryError extends Error {
  readonly code = "INVALID_PROPERTY_CLIENT_DIRECTORY_QUERY";
  constructor(readonly field: "limit" | "cursor" | "search") {
    super(`Invalid Property client directory query ${field}`);
  }
}

export class CreatePropertyClient {
  constructor(
    private readonly repository: PropertyClientRepository,
    private readonly identifiers: PropertyClientIdentifierGenerator,
    private readonly clock: PropertyClientClock,
  ) {}

  async execute(command: CreatePropertyClientCommand): Promise<PropertyClientView> {
    const tenantId = authorizedTenant(command.authority, "CREATE_PROPERTY_CLIENT");
    const now = this.clock.now();
    const client = PropertyClient.create({
      clientId: this.identifiers.generate(), tenantId, displayName: command.displayName,
      ...(command.email === undefined ? {} : { email: command.email }),
      ...(command.phoneNumber === undefined ? {} : { phoneNumber: command.phoneNumber }),
      createdAt: now, updatedAt: now,
    });
    await this.repository.save(client, command.correlationId, command.authority.actorId);
    return toView(client);
  }
}

export class ListPropertyClients {
  constructor(private readonly repository: PropertyClientRepository) {}

  async execute(query: ListPropertyClientsQuery): Promise<ListPropertyClientsResult> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_CLIENTS");
    const limit = query.limit ?? DEFAULT_PROPERTY_CLIENT_DIRECTORY_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PROPERTY_CLIENT_DIRECTORY_LIMIT) {
      throw new InvalidPropertyClientDirectoryQueryError("limit");
    }
    const search = query.search?.trim();
    if (search !== undefined && (search.length === 0 || search.length > MAX_PROPERTY_CLIENT_DIRECTORY_SEARCH_LENGTH)) {
      throw new InvalidPropertyClientDirectoryQueryError("search");
    }
    const page: PropertyClientDirectoryPage = await this.repository.list({
      tenantId, limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(search === undefined ? {} : { search }),
    });
    return {
      items: page.items.map(toView),
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      canCreateClient: query.authority.grants.includes("CREATE_PROPERTY_CLIENT"),
    };
  }
}

export class RetrievePropertyClient {
  constructor(private readonly repository: PropertyClientRepository) {}

  async execute(query: RetrievePropertyClientQuery): Promise<PropertyClientView> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_CLIENTS");
    const client = await this.repository.findById(tenantId, query.clientId);
    if (client === undefined) throw new PropertyClientNotFoundError();
    return toView(client);
  }
}

function toView(client: PropertyClient): PropertyClientView {
  const { tenantId: _tenantId, ...view } = client.values;
  return view;
}
