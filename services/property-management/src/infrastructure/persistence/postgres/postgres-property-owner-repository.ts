import { withTenantPostgresTransaction } from "@monpiole/persistence";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

import { PropertyOwnerPersistenceFailureError, type PropertyOwnerRepository } from "../../../application/property-owner-repository.js";
import {
  InvalidPropertyOwnerInputError, InvalidPropertyOwnerServerValueError, PropertyOwner,
  PropertyOwnerTypeChangeNotAllowedError,
  type PropertyOwnerContactInformation,
  type PropertyOwnerIdentity,
} from "../../../domain/property-owner.js";
import { propertyOwners } from "./schema.js";

export class PostgresPropertyOwnerRepository implements PropertyOwnerRepository {
  constructor(private readonly pool: Pool) {}

  async save(owner: PropertyOwner, correlationId: string, actorId: string): Promise<void> {
    try {
      await withTenantPostgresTransaction(this.pool, owner.values.tenantId, async (scope) => {
        await scope.database().insert(propertyOwners).values(toInsert(owner, correlationId, actorId));
      });
    } catch {
      throw new PropertyOwnerPersistenceFailureError();
    }
  }

  findById(tenantId: string, ownerId: string): Promise<PropertyOwner | undefined> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(propertyOwners).where(and(
        eq(propertyOwners.tenantId, tenantId), eq(propertyOwners.ownerId, ownerId),
      )).limit(1))[0];
      return row === undefined ? undefined : toOwner(row);
    }));
  }

  updateAtomically(
    tenantId: string,
    ownerId: string,
    update: (owner: PropertyOwner) => PropertyOwner,
    trace: { readonly correlationId: string; readonly actorId: string },
  ): Promise<PropertyOwner | undefined> {
    return this.persistence(async () => withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
      const row = (await scope.database().select().from(propertyOwners).where(and(
        eq(propertyOwners.tenantId, tenantId), eq(propertyOwners.ownerId, ownerId),
      )).limit(1).for("update"))[0];
      if (row === undefined) return undefined;
      const owner = update(toOwner(row));
      const identity = owner.values.identity;
      await scope.database().update(propertyOwners).set({
        firstName: identity.ownerType === "INDIVIDUAL" ? identity.firstName : null,
        lastName: identity.ownerType === "INDIVIDUAL" ? identity.lastName : null,
        legalName: identity.ownerType === "LEGAL_ENTITY" ? identity.legalName : null,
        registrationNumber: identity.ownerType === "LEGAL_ENTITY" ? identity.registrationNumber ?? null : null,
        phoneNumber: owner.values.contactInformation.phoneNumber ?? null,
        email: owner.values.contactInformation.email ?? null,
        updatedAt: owner.values.updatedAt, correlationId: trace.correlationId, actorId: trace.actorId,
      }).where(and(eq(propertyOwners.tenantId, tenantId), eq(propertyOwners.ownerId, ownerId)));
      return owner;
    }));
  }

  private async persistence<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof InvalidPropertyOwnerInputError
        || error instanceof InvalidPropertyOwnerServerValueError
        || error instanceof PropertyOwnerTypeChangeNotAllowedError) throw error;
      throw new PropertyOwnerPersistenceFailureError();
    }
  }
}

function toInsert(owner: PropertyOwner, correlationId: string, actorId: string) {
  const value = owner.values;
  const identity = value.identity;
  return {
    ownerId: value.ownerId, tenantId: value.tenantId, ownerType: identity.ownerType,
    firstName: identity.ownerType === "INDIVIDUAL" ? identity.firstName : null,
    lastName: identity.ownerType === "INDIVIDUAL" ? identity.lastName : null,
    legalName: identity.ownerType === "LEGAL_ENTITY" ? identity.legalName : null,
    registrationNumber: identity.ownerType === "LEGAL_ENTITY" ? identity.registrationNumber ?? null : null,
    phoneNumber: value.contactInformation.phoneNumber ?? null,
    email: value.contactInformation.email ?? null,
    createdAt: value.createdAt, updatedAt: value.updatedAt, correlationId, actorId,
  };
}

type PropertyOwnerRow = typeof propertyOwners.$inferSelect;
function toOwner(row: PropertyOwnerRow): PropertyOwner {
  let identity: PropertyOwnerIdentity;
  if (row.ownerType === "INDIVIDUAL") {
    if (row.firstName === null || row.lastName === null) throw new Error("Persisted individual owner identity is invalid");
    identity = { ownerType: "INDIVIDUAL", firstName: row.firstName, lastName: row.lastName };
  } else if (row.ownerType === "LEGAL_ENTITY") {
    if (row.legalName === null) throw new Error("Persisted legal entity owner identity is invalid");
    identity = {
      ownerType: "LEGAL_ENTITY", legalName: row.legalName,
      ...(row.registrationNumber === null ? {} : { registrationNumber: row.registrationNumber }),
    };
  } else {
    throw new Error("Persisted property owner type is invalid");
  }
  const contactInformation: PropertyOwnerContactInformation = {
    ...(row.phoneNumber === null ? {} : { phoneNumber: row.phoneNumber }),
    ...(row.email === null ? {} : { email: row.email }),
  };
  return PropertyOwner.rehydrate({
    ownerId: row.ownerId, tenantId: row.tenantId, identity, contactInformation,
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
  });
}
