import { describe, expect, it } from "vitest";

import {
  CreateTenant,
  CreateTenantForbiddenError,
  DuplicateTenantEmailError,
  IdempotencyConflictError,
  InvalidTenantInputError,
  type CreateTenantTransaction,
  type CreateTenantUnitOfWork,
  type IdempotencyRecord,
  type TenantCreatedRecord,
} from "../../services/tenant-management/src/index.js";
import { Tenant } from "../../services/tenant-management/src/domain/tenant.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CORRELATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CREATED_AT = "2026-08-25T12:00:00.000Z";

class MemoryTransaction implements CreateTenantTransaction {
  tenants: Tenant[] = [];
  idempotency: IdempotencyRecord[] = [];
  events: TenantCreatedRecord[] = [];
  async acquireIdempotencyKey() {}
  async findIdempotency(authorityId: string, key: string) {
    return this.idempotency.find((record) => record.authorityId === authorityId && record.idempotencyKey === key);
  }
  async findByResponsibleEmail(email: string) {
    return this.tenants.find((tenant) => tenant.values.responsibleEmail === email);
  }
  async insertTenant(tenant: Tenant) { this.tenants.push(tenant); }
  async insertIdempotency(record: IdempotencyRecord) { this.idempotency.push(record); }
  async recordTenantCreated(event: TenantCreatedRecord) { this.events.push(event); }
}

class MemoryUnitOfWork implements CreateTenantUnitOfWork {
  executions = 0;
  constructor(readonly transaction = new MemoryTransaction()) {}
  async execute<Result>(operation: (transaction: CreateTenantTransaction) => Promise<Result>) {
    this.executions += 1;
    return operation(this.transaction);
  }
}

function command(key = "create-tenant-1") {
  return {
    organizationName: "  MonPiole Agency  ", responsiblePersonName: "  Ada Example  ",
    responsibleEmail: "  ADA@EXAMPLE.INVALID ", responsibleTelephone: "+2250102030405",
    country: "CI", authority: { actorId: "actor-platform-1", authorityId: "platform-admin" },
    correlationId: CORRELATION_ID, idempotencyKey: key,
  };
}

function useCase(unitOfWork: MemoryUnitOfWork, authorized = true) {
  let authorizationCalls = 0;
  return {
    authorizationCalls: () => authorizationCalls,
    handler: new CreateTenant(
      { authorizeCreateTenant: async () => { authorizationCalls += 1; return authorized; } },
      unitOfWork, { generate: () => TENANT_ID }, { generate: () => EVENT_ID }, { now: () => CREATED_AT },
    ),
  };
}

describe("Create Tenant Domain and Application", () => {
  it("creates one normalized PENDING tenant with correlated idempotency and event records", async () => {
    const unit = new MemoryUnitOfWork();
    const created = useCase(unit);
    await expect(created.handler.execute(command())).resolves.toEqual({
      tenantId: TENANT_ID, lifecycleState: "PENDING", createdAt: CREATED_AT,
    });
    expect(unit.transaction.tenants[0]?.values).toMatchObject({
      organizationName: "MonPiole Agency", responsiblePersonName: "Ada Example",
      responsibleEmail: "ada@example.invalid", responsibleTelephone: "+2250102030405", country: "CI",
    });
    expect(unit.transaction.idempotency).toHaveLength(1);
    expect(unit.transaction.events).toEqual([{
      eventId: EVENT_ID, tenantId: TENANT_ID, correlationId: CORRELATION_ID,
      occurredAt: CREATED_AT, lifecycleState: "PENDING",
    }]);
  });

  it("authorizes before persistence and rejects an unauthorized command without side effects", async () => {
    const unit = new MemoryUnitOfWork();
    const created = useCase(unit, false);
    await expect(created.handler.execute(command())).rejects.toBeInstanceOf(CreateTenantForbiddenError);
    expect(created.authorizationCalls()).toBe(1);
    expect(unit.executions).toBe(0);
    expect(unit.transaction.tenants).toHaveLength(0);
    expect(unit.transaction.events).toHaveLength(0);
  });

  it("returns the original outcome for the same key and normalized intent", async () => {
    const unit = new MemoryUnitOfWork();
    const created = useCase(unit);
    const first = await created.handler.execute(command());
    const replay = await created.handler.execute(command());
    expect(replay).toEqual(first);
    expect(unit.transaction.tenants).toHaveLength(1);
    expect(unit.transaction.events).toHaveLength(1);
  });

  it("rejects the same key with a different normalized intent", async () => {
    const unit = new MemoryUnitOfWork();
    const created = useCase(unit);
    await created.handler.execute(command());
    await expect(created.handler.execute({ ...command(), organizationName: "Different" }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("rejects a duplicate normalized email under another key", async () => {
    const unit = new MemoryUnitOfWork();
    const created = useCase(unit);
    await created.handler.execute(command());
    await expect(created.handler.execute(command("create-tenant-2")))
      .rejects.toBeInstanceOf(DuplicateTenantEmailError);
  });

  it.each([
    [{ organizationName: "   " }, "organizationName"],
    [{ responsiblePersonName: "   " }, "responsiblePersonName"],
    [{ responsibleEmail: "   " }, "responsibleEmail"],
    [{ responsibleTelephone: "010203" }, "responsibleTelephone"],
    [{ country: "ci" }, "country"],
  ])("rejects invalid normalized input", async (change, field) => {
    const unit = new MemoryUnitOfWork();
    const created = useCase(unit);
    await expect(created.handler.execute({ ...command(), ...change })).rejects.toMatchObject({ field });
    expect(unit.transaction.tenants).toHaveLength(0);
  });

  it("rejects non-v4 tenant identifiers in the Domain", () => {
    expect(() => Tenant.create({
      id: "550e8400-e29b-11d4-a716-446655440000", organizationName: "Agency",
      responsiblePersonName: "Ada", responsibleEmail: "ada@example.invalid",
      responsibleTelephone: "+2250102030405", country: "CI", createdAt: CREATED_AT,
    })).toThrow(InvalidTenantInputError);
  });
});
