import type { PropertyClient } from "../domain/property-client.js";
import type { PropertyContract } from "../domain/property-contract.js";

export interface PropertyContractCursor {
  readonly createdAt: string;
  readonly contractId: string;
}

export interface PropertyContractCriteria {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly limit: number;
  readonly cursor?: PropertyContractCursor;
}

export interface PropertyContractRecord {
  readonly contract: PropertyContract;
  readonly client: PropertyClient;
}

export interface PropertyContractPage {
  readonly items: readonly PropertyContractRecord[];
  readonly nextCursor?: PropertyContractCursor;
}

export interface PropertyContractTrace {
  readonly correlationId: string;
  readonly actorId: string;
}

export interface PropertyContractRepository {
  save(contract: PropertyContract, trace: PropertyContractTrace): Promise<void>;
  findById(tenantId: string, propertyId: string, contractId: string): Promise<PropertyContractRecord | undefined>;
  list(criteria: PropertyContractCriteria): Promise<PropertyContractPage | undefined>;
  updateAtomically(
    tenantId: string,
    propertyId: string,
    contractId: string,
    update: (contract: PropertyContract) => PropertyContract,
    trace: PropertyContractTrace,
  ): Promise<PropertyContractRecord | undefined>;
}

export class PropertyContractPersistenceFailureError extends Error {
  readonly code = "PROPERTY_CONTRACT_PERSISTENCE_FAILURE";
  constructor() { super("Property contract persistence failed"); }
}

export class PropertyContractReferenceConflictError extends Error {
  readonly code = "PROPERTY_CONTRACT_REFERENCE_CONFLICT";
  constructor() { super("Property contract reference already exists"); }
}
