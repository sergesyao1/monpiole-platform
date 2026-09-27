GRANT SELECT ("property_id", "tenant_id", "transaction_type", "structural_role", "commercialization_mode")
ON TABLE "property_management"."properties" TO "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT ("tenant_id", "building_id", "property_id", "building_property_id")
ON TABLE "property_management"."property_buildings" TO "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT ("tenant_id", "building_id", "unit_property_id")
ON TABLE "property_management"."property_building_units" TO "monpiole_runtime";
