CREATE TABLE "rental_operations"."outbox" (
	"event_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_version" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"deduplication_key" text NOT NULL,
	"envelope" jsonb NOT NULL,
	CONSTRAINT "rental_operations_outbox_event_pk" PRIMARY KEY("event_id"),
	CONSTRAINT "rental_operations_outbox_tenant_dedup_unique" UNIQUE("tenant_id","deduplication_key"),
	CONSTRAINT "rental_operations_outbox_event_check" CHECK ("rental_operations"."outbox"."event_type" IN (
    'monpiole.rental-operations.stay-started', 'monpiole.rental-operations.stay-completed',
    'monpiole.rental-operations.occupancy-started', 'monpiole.rental-operations.occupancy-ended',
    'monpiole.rental-operations.entry-inspection-completed', 'monpiole.rental-operations.exit-inspection-completed',
    'monpiole.rental-operations.allocation-created', 'monpiole.rental-operations.allocation-released',
    'monpiole.rental-operations.operational-block-created', 'monpiole.rental-operations.operational-block-released'
  ) AND "rental_operations"."outbox"."event_version" = '1')
);
--> statement-breakpoint
ALTER TABLE "rental_operations"."outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "rental_operations_outbox_tenant_occurred_idx" ON "rental_operations"."outbox" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE POLICY "rental_operations_outbox_tenant_isolation" ON "rental_operations"."outbox" AS PERMISSIVE FOR ALL TO public USING ("rental_operations"."outbox"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("rental_operations"."outbox"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "rental_operations"."outbox" FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON TABLE "rental_operations"."outbox" TO "monpiole_runtime";
