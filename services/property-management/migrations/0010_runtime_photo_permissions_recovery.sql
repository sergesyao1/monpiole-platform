ALTER TABLE "property_management"."property_photos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_photos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_photo_standards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_photo_standards" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_primary_photo_audits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_primary_photo_audits" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "property_management" TO "monpiole_runtime";
--> statement-breakpoint
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE "property_management"."property_photos" FROM "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "property_management"."property_photos" TO "monpiole_runtime";
--> statement-breakpoint
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE "property_management"."property_photo_standards" FROM "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE
ON TABLE "property_management"."property_photo_standards" TO "monpiole_runtime";
--> statement-breakpoint
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE "property_management"."property_primary_photo_audits" FROM "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT, INSERT
ON TABLE "property_management"."property_primary_photo_audits" TO "monpiole_runtime";
