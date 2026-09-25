ALTER TABLE "property_management"."properties" ADD COLUMN "usable_surface_square_meters" double precision;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "rooms" integer;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "bedrooms" integer;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "bathrooms" integer;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "furnished" boolean;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "commercial_kind" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "rent_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "rent_period" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "security_deposit_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "charges_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "rate_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "pricing_unit" text;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "sale_price_amount_minor" bigint;
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_details_values_check" CHECK (
  ("usable_surface_square_meters" IS NULL OR ("usable_surface_square_meters" > 0 AND "usable_surface_square_meters" < 'Infinity'::double precision))
  AND ("rooms" IS NULL OR "rooms" >= 0)
  AND ("bedrooms" IS NULL OR "bedrooms" >= 0)
  AND ("bathrooms" IS NULL OR "bathrooms" >= 0)
  AND ("rooms" IS NULL OR "bedrooms" IS NULL OR "bedrooms" <= "rooms")
);
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_commercial_terms_check" CHECK (
  ("commercial_kind" IS NULL AND "currency" IS NULL
    AND "usable_surface_square_meters" IS NULL AND "rooms" IS NULL AND "bedrooms" IS NULL AND "bathrooms" IS NULL AND "furnished" IS NULL
    AND "rent_amount_minor" IS NULL AND "rent_period" IS NULL AND "security_deposit_amount_minor" IS NULL
    AND "charges_amount_minor" IS NULL AND "rate_amount_minor" IS NULL AND "pricing_unit" IS NULL AND "sale_price_amount_minor" IS NULL)
  OR
  (("usable_surface_square_meters" IS NOT NULL OR "rooms" IS NOT NULL OR "bedrooms" IS NOT NULL OR "bathrooms" IS NOT NULL OR "furnished" IS NOT NULL)
    AND "currency" ~ '^[A-Z]{3}$'
    AND (
      ("commercial_kind" = 'LONG_TERM_RENTAL' AND "transaction_type" = 'LONG_TERM_RENTAL'
        AND "rent_amount_minor" BETWEEN 0 AND 9007199254740991 AND "rent_period" = 'MONTH'
        AND ("security_deposit_amount_minor" IS NULL OR "security_deposit_amount_minor" BETWEEN 0 AND 9007199254740991)
        AND ("charges_amount_minor" IS NULL OR "charges_amount_minor" BETWEEN 0 AND 9007199254740991)
        AND "rate_amount_minor" IS NULL AND "pricing_unit" IS NULL AND "sale_price_amount_minor" IS NULL)
      OR ("commercial_kind" = 'SHORT_TERM_RENTAL' AND "transaction_type" = 'SHORT_TERM_RENTAL'
        AND "rate_amount_minor" BETWEEN 0 AND 9007199254740991 AND "pricing_unit" IN ('NIGHT', 'WEEK')
        AND "rent_amount_minor" IS NULL AND "rent_period" IS NULL AND "security_deposit_amount_minor" IS NULL
        AND "charges_amount_minor" IS NULL AND "sale_price_amount_minor" IS NULL)
      OR ("commercial_kind" = 'SALE' AND "transaction_type" = 'SALE'
        AND "sale_price_amount_minor" BETWEEN 0 AND 9007199254740991
        AND "rent_amount_minor" IS NULL AND "rent_period" IS NULL AND "security_deposit_amount_minor" IS NULL
        AND "charges_amount_minor" IS NULL AND "rate_amount_minor" IS NULL AND "pricing_unit" IS NULL)
    ))
);
