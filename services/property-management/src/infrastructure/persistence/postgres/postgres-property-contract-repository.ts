import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Pool } from "pg";

import {
  PropertyContractPersistenceFailureError,
  PropertyContractReferenceConflictError,
  type PropertyContractCriteria,
  type PropertyContractPage,
  type PropertyContractRecord,
  type PropertyContractRepository,
  type PropertyContractTrace,
} from "../../../application/property-contract-repository.js";
import {
  InvalidPropertyContractInputError,
  InvalidPropertyContractServerValueError,
  PropertyContract,
  PropertyContractPropertyNotEligibleError,
  PropertyContractTransitionNotAllowedError,
  PropertyContractUpdateNotAllowedError,
} from "../../../domain/property-contract.js";
import { toClient } from "./postgres-property-client-repository.js";
import { properties, propertyClients, propertyContracts } from "./schema.js";

export class PostgresPropertyContractRepository implements PropertyContractRepository {
  constructor(private readonly pool: Pool) {}

  save(contract: PropertyContract, trace: PropertyContractTrace): Promise<void> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, contract.values.tenantId, async (scope) => {
      await scope.database().insert(propertyContracts).values(toInsert(contract, trace));
    }));
  }

  findById(tenantId: string, propertyId: string, contractId: string): Promise<PropertyContractRecord | undefined> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select({ contract: propertyContracts, client: propertyClients })
        .from(propertyContracts)
        .innerJoin(propertyClients, and(
          eq(propertyClients.tenantId, propertyContracts.tenantId),
          eq(propertyClients.clientId, propertyContracts.clientId),
        ))
        .where(and(eq(propertyContracts.tenantId, tenantId), eq(propertyContracts.propertyId, propertyId),
          eq(propertyContracts.contractId, contractId))).limit(1))[0];
      return row === undefined ? undefined : toRecord(row);
    }));
  }

  list(criteria: PropertyContractCriteria): Promise<PropertyContractPage | undefined> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, criteria.tenantId, async (scope) => {
      const exists = (await scope.database().select({ id: properties.propertyId }).from(properties).where(and(
        eq(properties.tenantId, criteria.tenantId), eq(properties.propertyId, criteria.propertyId),
      )).limit(1))[0];
      if (exists === undefined) return undefined;
      const cursorFilter = criteria.cursor === undefined ? undefined : or(
        lt(propertyContracts.createdAt, criteria.cursor.createdAt),
        and(eq(propertyContracts.createdAt, criteria.cursor.createdAt),
          lt(propertyContracts.contractId, criteria.cursor.contractId)),
      );
      const rows = await scope.database().select({ contract: propertyContracts, client: propertyClients })
        .from(propertyContracts)
        .innerJoin(propertyClients, and(
          eq(propertyClients.tenantId, propertyContracts.tenantId),
          eq(propertyClients.clientId, propertyContracts.clientId),
        ))
        .where(and(eq(propertyContracts.tenantId, criteria.tenantId),
          eq(propertyContracts.propertyId, criteria.propertyId), cursorFilter))
        .orderBy(desc(propertyContracts.createdAt), desc(propertyContracts.contractId)).limit(criteria.limit + 1);
      const items = rows.slice(0, criteria.limit).map(toRecord);
      const last = rows.length > criteria.limit ? items.at(-1) : undefined;
      return {
        items,
        ...(last === undefined ? {} : {
          nextCursor: {
            createdAt: last.contract.values.createdAt,
            contractId: last.contract.values.contractId,
          },
        }),
      };
    }));
  }

  updateAtomically(
    tenantId: string,
    propertyId: string,
    contractId: string,
    update: (contract: PropertyContract) => PropertyContract,
    trace: PropertyContractTrace,
  ): Promise<PropertyContractRecord | undefined> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(propertyContracts).where(and(
        eq(propertyContracts.tenantId, tenantId), eq(propertyContracts.propertyId, propertyId),
        eq(propertyContracts.contractId, contractId),
      )).limit(1).for("update"))[0];
      if (row === undefined) return undefined;
      const current = toContract(row);
      const changed = update(current);
      if (changed !== current) {
        await scope.database().update(propertyContracts).set(toUpdate(row, current, changed, trace)).where(and(
          eq(propertyContracts.tenantId, tenantId), eq(propertyContracts.contractId, contractId),
        ));
      }
      const client = (await scope.database().select().from(propertyClients).where(and(
        eq(propertyClients.tenantId, tenantId), eq(propertyClients.clientId, changed.values.clientId),
      )).limit(1))[0];
      if (client === undefined) throw new PropertyContractPersistenceFailureError();
      return { contract: changed, client: toClient(client) };
    }));
  }

  private async persistence<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      const constraint = uniqueViolationConstraint(error);
      if (constraint === "property_contracts_tenant_reference_unique") {
        throw new PropertyContractReferenceConflictError();
      }
      if (error instanceof InvalidPropertyContractInputError
        || error instanceof InvalidPropertyContractServerValueError
        || error instanceof PropertyContractTransitionNotAllowedError
        || error instanceof PropertyContractUpdateNotAllowedError
        || error instanceof PropertyContractPropertyNotEligibleError) throw error;
      if (error instanceof PropertyContractPersistenceFailureError) throw error;
      throw new PropertyContractPersistenceFailureError();
    }
  }
}

type ContractRow = typeof propertyContracts.$inferSelect;
type ClientRow = typeof propertyClients.$inferSelect;

function toRecord(row: { readonly contract: ContractRow; readonly client: ClientRow }): PropertyContractRecord {
  return { contract: toContract(row.contract), client: toClient(row.client) };
}

function toContract(row: ContractRow): PropertyContract {
  return PropertyContract.rehydrate({
    contractId: row.contractId, tenantId: row.tenantId, propertyId: row.propertyId, clientId: row.clientId,
    contractType: row.contractType as PropertyContract["values"]["contractType"],
    status: row.status as PropertyContract["values"]["status"], reference: row.reference,
    ...(row.startDate === null ? {} : { startDate: row.startDate }),
    ...(row.endDate === null ? {} : { endDate: row.endDate }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
    ...(row.activatedAt === null ? {} : { activatedAt: new Date(row.activatedAt).toISOString() }),
    ...(row.endedAt === null ? {} : { endedAt: new Date(row.endedAt).toISOString() }),
    ...(row.cancelledAt === null ? {} : { cancelledAt: new Date(row.cancelledAt).toISOString() }),
  });
}

function toInsert(contract: PropertyContract, trace: PropertyContractTrace) {
  const value = contract.values;
  return {
    contractId: value.contractId, tenantId: value.tenantId, propertyId: value.propertyId, clientId: value.clientId,
    contractType: value.contractType, status: value.status, reference: value.reference,
    startDate: value.startDate ?? null, endDate: value.endDate ?? null, notes: value.notes ?? null,
    createdAt: value.createdAt, updatedAt: value.updatedAt,
    correlationId: trace.correlationId, actorId: trace.actorId,
  };
}

function toUpdate(
  row: ContractRow,
  current: PropertyContract,
  changed: PropertyContract,
  trace: PropertyContractTrace,
) {
  const value = changed.values;
  const activated = current.values.status !== "ACTIVE" && value.activatedAt !== undefined
    && row.activatedAt === null;
  const ended = current.values.status !== "ENDED" && value.status === "ENDED";
  const cancelled = current.values.status !== "CANCELLED" && value.status === "CANCELLED";
  return {
    clientId: value.clientId, contractType: value.contractType, status: value.status, reference: value.reference,
    startDate: value.startDate ?? null, endDate: value.endDate ?? null, notes: value.notes ?? null,
    updatedAt: value.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId,
    activatedAt: value.activatedAt ?? null,
    activatedByActorId: activated ? trace.actorId : row.activatedByActorId,
    activationCorrelationId: activated ? trace.correlationId : row.activationCorrelationId,
    endedAt: value.endedAt ?? null,
    endedByActorId: ended ? trace.actorId : row.endedByActorId,
    endingCorrelationId: ended ? trace.correlationId : row.endingCorrelationId,
    cancelledAt: value.cancelledAt ?? null,
    cancelledByActorId: cancelled ? trace.actorId : row.cancelledByActorId,
    cancellationCorrelationId: cancelled ? trace.correlationId : row.cancellationCorrelationId,
  };
}

function uniqueViolationConstraint(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4 && current !== null && typeof current === "object"; depth += 1) {
    if ("code" in current && current.code === "23505") {
      return "constraint" in current && typeof current.constraint === "string" ? current.constraint : undefined;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
