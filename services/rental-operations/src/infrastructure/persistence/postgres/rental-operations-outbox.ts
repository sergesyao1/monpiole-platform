import type { PostgresTransactionScope } from "@monpiole/persistence";

import type { RentalOperationsEventType } from "../../../application/rental-operations-ports.js";

export function recordRentalOperationsEvent(
  scope: PostgresTransactionScope,
  input: Readonly<{
    tenantId: string;
    eventType: RentalOperationsEventType;
    aggregateId: string;
    correlationId: string;
    occurredAt: string;
    payload: Readonly<Record<string, unknown>>;
  }>,
): Promise<readonly Record<string, unknown>[]> {
  const deduplicationKey = `${input.eventType}:${input.aggregateId}`;
  return scope.query(`WITH event_identity AS (SELECT gen_random_uuid() AS event_id)
    INSERT INTO rental_operations.outbox
    (event_id,tenant_id,event_type,event_version,occurred_at,correlation_id,deduplication_key,envelope)
    SELECT event_id,$1::uuid,$2::text,'1',$3::timestamptz,$4::uuid,$5::text,jsonb_build_object(
      'eventId',event_id::text,'tenantId',$1::text,'eventType',$2::text,'eventVersion',1,'occurredAt',$3::text,
      'correlationId',$4::text,'producer','rental-operations','payload',$6::jsonb) FROM event_identity
    ON CONFLICT (tenant_id,deduplication_key) DO NOTHING`,
  [input.tenantId, input.eventType, input.occurredAt, input.correlationId, deduplicationKey, JSON.stringify(input.payload)]);
}
