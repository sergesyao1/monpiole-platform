ALTER TABLE "property_management"."property_inquiries" DROP CONSTRAINT "property_inquiries_contact_check";--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" DROP CONSTRAINT "property_inquiries_consent_check";--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" DROP CONSTRAINT "property_inquiries_lifecycle_check";--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD COLUMN "intent" text DEFAULT 'CONTACT' NOT NULL;--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD COLUMN "preferred_contact_channel" text;--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD CONSTRAINT "property_inquiries_intent_check" CHECK ("property_management"."property_inquiries"."intent" IN ('CONTACT', 'VIEWING_REQUEST'));--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD CONSTRAINT "property_inquiries_preferred_contact_channel_check" CHECK ((
      "property_management"."property_inquiries"."preferred_contact_channel" IS NULL
      OR (
        "property_management"."property_inquiries"."preferred_contact_channel" = 'EMAIL'
        AND "property_management"."property_inquiries"."email" IS NOT NULL
      )
      OR (
        "property_management"."property_inquiries"."preferred_contact_channel" IN ('PHONE', 'SMS')
        AND "property_management"."property_inquiries"."phone_number" IS NOT NULL
      )
    ));--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD CONSTRAINT "property_inquiries_contact_check" CHECK (char_length(btrim("property_management"."property_inquiries"."contact_name")) BETWEEN 1 AND 200
      AND ("property_management"."property_inquiries"."email" IS NOT NULL OR "property_management"."property_inquiries"."phone_number" IS NOT NULL)
      AND (
        "property_management"."property_inquiries"."email" IS NULL
        OR (
          char_length("property_management"."property_inquiries"."email") BETWEEN 3 AND 320
          AND "property_management"."property_inquiries"."email" = lower("property_management"."property_inquiries"."email")
          AND "property_management"."property_inquiries"."email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        )
      )
      AND (
        "property_management"."property_inquiries"."phone_number" IS NULL
        OR char_length(btrim("property_management"."property_inquiries"."phone_number")) BETWEEN 1 AND 100
      )
      AND (
        "property_management"."property_inquiries"."message" IS NULL
        OR char_length(btrim("property_management"."property_inquiries"."message")) BETWEEN 1 AND 2000
      ));--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD CONSTRAINT "property_inquiries_consent_check" CHECK (char_length(btrim("property_management"."property_inquiries"."consent_version")) BETWEEN 1 AND 50
      AND char_length(btrim("property_management"."property_inquiries"."idempotency_key")) BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD CONSTRAINT "property_inquiries_lifecycle_check" CHECK ((
      "property_management"."property_inquiries"."status" = 'NEW'
      AND "property_management"."property_inquiries"."acknowledged_at" IS NULL
      AND "property_management"."property_inquiries"."closed_at" IS NULL
    )
    OR (
      "property_management"."property_inquiries"."status" = 'ACKNOWLEDGED'
      AND "property_management"."property_inquiries"."acknowledged_at" IS NOT NULL
      AND "property_management"."property_inquiries"."closed_at" IS NULL
    )
    OR (
      "property_management"."property_inquiries"."status" = 'CLOSED'
      AND "property_management"."property_inquiries"."closed_at" IS NOT NULL
    ));