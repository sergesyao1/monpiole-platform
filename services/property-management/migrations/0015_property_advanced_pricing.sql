ALTER TABLE "property_management"."properties" DROP CONSTRAINT "properties_commercial_terms_check";--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "agency_fee_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "cleaning_fee_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "minimum_stay_nights" integer;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD COLUMN "pricing_version" smallint DEFAULT 1;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ALTER COLUMN "pricing_version" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_commercial_terms_check" CHECK (
    ("property_management"."properties"."commercial_kind" IS NULL AND "property_management"."properties"."currency" IS NULL
      AND "property_management"."properties"."rent_amount_minor" IS NULL AND "property_management"."properties"."rent_period" IS NULL AND "property_management"."properties"."security_deposit_amount_minor" IS NULL
      AND "property_management"."properties"."charges_amount_minor" IS NULL AND "property_management"."properties"."rate_amount_minor" IS NULL AND "property_management"."properties"."pricing_unit" IS NULL
      AND "property_management"."properties"."sale_price_amount_minor" IS NULL AND "property_management"."properties"."agency_fee_amount_minor" IS NULL
      AND "property_management"."properties"."cleaning_fee_amount_minor" IS NULL AND "property_management"."properties"."minimum_stay_nights" IS NULL
      AND ("property_management"."properties"."pricing_version" IS NULL OR "property_management"."properties"."pricing_version" = 1))
    OR
    ("property_management"."properties"."pricing_version" IN (1, 2)
      AND (("property_management"."properties"."pricing_version" = 1 AND "property_management"."properties"."currency" ~ '^[A-Z]{3}$')
        OR ("property_management"."properties"."pricing_version" = 2 AND "property_management"."properties"."currency" = 'XOF'))
      AND ("property_management"."properties"."pricing_version" = 2 OR ("property_management"."properties"."agency_fee_amount_minor" IS NULL
        AND "property_management"."properties"."cleaning_fee_amount_minor" IS NULL AND "property_management"."properties"."minimum_stay_nights" IS NULL
        AND ("property_management"."properties"."commercial_kind" <> 'SHORT_TERM_RENTAL' OR "property_management"."properties"."security_deposit_amount_minor" IS NULL)))
      AND (
        ("property_management"."properties"."commercial_kind" = 'LONG_TERM_RENTAL' AND "property_management"."properties"."transaction_type" = 'LONG_TERM_RENTAL'
          AND "property_management"."properties"."rent_amount_minor" BETWEEN CASE WHEN "property_management"."properties"."pricing_version" = 1 THEN 0 ELSE 1 END AND 9007199254740991
          AND "property_management"."properties"."rent_period" = 'MONTH'
          AND ("property_management"."properties"."security_deposit_amount_minor" IS NULL OR "property_management"."properties"."security_deposit_amount_minor" BETWEEN 0 AND 9007199254740991)
          AND ("property_management"."properties"."charges_amount_minor" IS NULL OR "property_management"."properties"."charges_amount_minor" BETWEEN 0 AND 9007199254740991)
          AND ("property_management"."properties"."agency_fee_amount_minor" IS NULL OR "property_management"."properties"."agency_fee_amount_minor" BETWEEN 0 AND 9007199254740991)
          AND "property_management"."properties"."rate_amount_minor" IS NULL AND "property_management"."properties"."pricing_unit" IS NULL AND "property_management"."properties"."sale_price_amount_minor" IS NULL
          AND "property_management"."properties"."cleaning_fee_amount_minor" IS NULL AND "property_management"."properties"."minimum_stay_nights" IS NULL)
        OR ("property_management"."properties"."commercial_kind" = 'SHORT_TERM_RENTAL' AND "property_management"."properties"."transaction_type" = 'SHORT_TERM_RENTAL'
          AND "property_management"."properties"."rate_amount_minor" BETWEEN CASE WHEN "property_management"."properties"."pricing_version" = 1 THEN 0 ELSE 1 END AND 9007199254740991
          AND "property_management"."properties"."pricing_unit" IN ('NIGHT', 'WEEK')
          AND ("property_management"."properties"."security_deposit_amount_minor" IS NULL OR "property_management"."properties"."security_deposit_amount_minor" BETWEEN 0 AND 9007199254740991)
          AND ("property_management"."properties"."cleaning_fee_amount_minor" IS NULL OR "property_management"."properties"."cleaning_fee_amount_minor" BETWEEN 0 AND 9007199254740991)
          AND ("property_management"."properties"."minimum_stay_nights" IS NULL OR "property_management"."properties"."minimum_stay_nights" >= 1)
          AND "property_management"."properties"."rent_amount_minor" IS NULL AND "property_management"."properties"."rent_period" IS NULL
          AND "property_management"."properties"."charges_amount_minor" IS NULL AND "property_management"."properties"."sale_price_amount_minor" IS NULL AND "property_management"."properties"."agency_fee_amount_minor" IS NULL)
        OR ("property_management"."properties"."commercial_kind" = 'SALE' AND "property_management"."properties"."transaction_type" = 'SALE'
          AND "property_management"."properties"."sale_price_amount_minor" BETWEEN CASE WHEN "property_management"."properties"."pricing_version" = 1 THEN 0 ELSE 1 END AND 9007199254740991
          AND ("property_management"."properties"."agency_fee_amount_minor" IS NULL OR "property_management"."properties"."agency_fee_amount_minor" BETWEEN 0 AND 9007199254740991)
          AND "property_management"."properties"."rent_amount_minor" IS NULL AND "property_management"."properties"."rent_period" IS NULL AND "property_management"."properties"."security_deposit_amount_minor" IS NULL
          AND "property_management"."properties"."charges_amount_minor" IS NULL AND "property_management"."properties"."rate_amount_minor" IS NULL AND "property_management"."properties"."pricing_unit" IS NULL
          AND "property_management"."properties"."cleaning_fee_amount_minor" IS NULL AND "property_management"."properties"."minimum_stay_nights" IS NULL)
      ))
  );--> statement-breakpoint
CREATE FUNCTION "property_management"."mark_property_pricing_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.commercial_kind IS NULL THEN
    NEW.pricing_version := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.pricing_version := 2;
  ELSIF ROW(
      OLD.commercial_kind, OLD.currency, OLD.rent_amount_minor, OLD.rent_period,
      OLD.security_deposit_amount_minor, OLD.charges_amount_minor, OLD.rate_amount_minor,
      OLD.pricing_unit, OLD.sale_price_amount_minor, OLD.agency_fee_amount_minor,
      OLD.cleaning_fee_amount_minor, OLD.minimum_stay_nights, OLD.pricing_version
    ) IS DISTINCT FROM ROW(
      NEW.commercial_kind, NEW.currency, NEW.rent_amount_minor, NEW.rent_period,
      NEW.security_deposit_amount_minor, NEW.charges_amount_minor, NEW.rate_amount_minor,
      NEW.pricing_unit, NEW.sale_price_amount_minor, NEW.agency_fee_amount_minor,
      NEW.cleaning_fee_amount_minor, NEW.minimum_stay_nights, NEW.pricing_version
    )
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'PUBLISHED')
    OR (OLD.status = 'DRAFT' AND NEW.status = 'WITHDRAWN') THEN
    NEW.pricing_version := 2;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "properties_pricing_version_marker"
BEFORE INSERT OR UPDATE ON "property_management"."properties"
FOR EACH ROW EXECUTE FUNCTION "property_management"."mark_property_pricing_version"();--> statement-breakpoint
GRANT SELECT ("agency_fee_amount_minor", "cleaning_fee_amount_minor", "minimum_stay_nights", "pricing_version"),
  INSERT ("agency_fee_amount_minor", "cleaning_fee_amount_minor", "minimum_stay_nights", "pricing_version"),
  UPDATE ("agency_fee_amount_minor", "cleaning_fee_amount_minor", "minimum_stay_nights", "pricing_version")
ON TABLE "property_management"."properties" TO "monpiole_runtime";--> statement-breakpoint
GRANT SELECT ("agency_fee_amount_minor", "cleaning_fee_amount_minor", "minimum_stay_nights")
ON TABLE "property_management"."properties" TO "monpiole_public_catalog_reader";
