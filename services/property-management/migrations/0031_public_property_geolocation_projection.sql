CREATE VIEW "property_management"."public_property_geolocations" WITH (security_barrier = true) AS
SELECT
  p."tenant_id",
  p."property_id",
  CASE WHEN effective."public_visibility" = 'APPROXIMATE' THEN round(effective."latitude", 2) ELSE effective."latitude" END AS "latitude",
  CASE WHEN effective."public_visibility" = 'APPROXIMATE' THEN round(effective."longitude", 2) ELSE effective."longitude" END AS "longitude",
  effective."public_visibility"
FROM "property_management"."properties" AS p
LEFT JOIN "property_management"."property_building_units" AS bu
  ON bu."tenant_id" = p."tenant_id" AND bu."unit_property_id" = p."property_id"
LEFT JOIN "property_management"."property_buildings" AS b
  ON b."tenant_id" = bu."tenant_id" AND b."building_id" = bu."building_id"
LEFT JOIN "property_management"."property_complex_children" AS direct_link
  ON direct_link."tenant_id" = p."tenant_id" AND direct_link."child_property_id" = p."property_id"
LEFT JOIN LATERAL (
  SELECT source."latitude", source."longitude", source."public_visibility"
  FROM "property_management"."property_geolocations" AS source
  WHERE source."tenant_id" = p."tenant_id"
    AND source."property_id" = ANY(CASE
      WHEN p."structural_role" = 'UNIT' THEN ARRAY[p."property_id", COALESCE(b."building_property_id", b."property_id"), b."property_id"]::uuid[]
      ELSE ARRAY[p."property_id", direct_link."complex_property_id"]::uuid[]
    END)
  ORDER BY array_position(CASE
    WHEN p."structural_role" = 'UNIT' THEN ARRAY[p."property_id", COALESCE(b."building_property_id", b."property_id"), b."property_id"]::uuid[]
    ELSE ARRAY[p."property_id", direct_link."complex_property_id"]::uuid[]
  END, source."property_id")
  LIMIT 1
) AS effective ON TRUE
WHERE p."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  AND p."status" = 'PUBLISHED'
  AND effective."public_visibility" IN ('EXACT', 'APPROXIMATE');
--> statement-breakpoint
REVOKE ALL ON TABLE "property_management"."public_property_geolocations" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT ON TABLE "property_management"."public_property_geolocations" TO "monpiole_public_catalog_reader";
