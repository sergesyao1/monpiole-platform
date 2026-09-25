CREATE TABLE "property_management"."property_inquiry_communications" (
	"communication_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"performed_by_actor_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_inquiry_communications_channel_check" CHECK ("property_management"."property_inquiry_communications"."channel" IN ('PHONE', 'SMS', 'EMAIL')),
	CONSTRAINT "property_inquiry_communications_direction_check" CHECK ("property_management"."property_inquiry_communications"."direction" IN ('OUTBOUND', 'INBOUND')),
	CONSTRAINT "property_inquiry_communications_status_check" CHECK ("property_management"."property_inquiry_communications"."status" IN ('RECORDED', 'SENT', 'FAILED')),
	CONSTRAINT "property_inquiry_communications_summary_check" CHECK ("property_management"."property_inquiry_communications"."summary" IS NULL
        OR char_length(btrim("property_management"."property_inquiry_communications"."summary")) BETWEEN 1 AND 2000),
	CONSTRAINT "property_inquiry_communications_actor_check" CHECK (char_length(btrim("property_management"."property_inquiry_communications"."performed_by_actor_id")) BETWEEN 1 AND 200),
	CONSTRAINT "property_inquiry_communications_time_check" CHECK ("property_management"."property_inquiry_communications"."occurred_at" <= "property_management"."property_inquiry_communications"."created_at")
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiry_communications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE UNIQUE INDEX "property_inquiries_tenant_property_inquiry_unique" ON "property_management"."property_inquiries" USING btree ("tenant_id","property_id","inquiry_id");--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiry_communications" ADD CONSTRAINT "property_inquiry_communications_inquiry_tenant_fk" FOREIGN KEY ("tenant_id","property_id","inquiry_id") REFERENCES "property_management"."property_inquiries"("tenant_id","property_id","inquiry_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_inquiry_communications_tenant_communication_unique" ON "property_management"."property_inquiry_communications" USING btree ("tenant_id","communication_id");--> statement-breakpoint
CREATE INDEX "property_inquiry_communications_tenant_property_inquiry_occurred_idx" ON "property_management"."property_inquiry_communications" USING btree ("tenant_id","property_id","inquiry_id","occurred_at" DESC NULLS LAST,"communication_id" DESC NULLS LAST);--> statement-breakpoint

CREATE POLICY "property_inquiry_communications_tenant_isolation" ON "property_management"."property_inquiry_communications" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_inquiry_communications"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_inquiry_communications"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiry_communications"
FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES
ON TABLE "property_management"."property_inquiry_communications"
FROM PUBLIC;
--> statement-breakpoint
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE "property_management"."property_inquiry_communications"
FROM "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT, INSERT
ON TABLE "property_management"."property_inquiry_communications"
TO "monpiole_runtime";
