export const migrationTargets = [
  { folder: "services/tenant-management/migrations", table: "tenant_management_migrations" },
  { folder: "services/identity/migrations", table: "identity_migrations" },
  { folder: "services/property-management/migrations", table: "property_management_migrations" },
  { folder: "services/rental-operations/migrations", table: "rental_operations_migrations" },
  { folder: "services/agency-onboarding/migrations", table: "agency_onboarding_migrations" },
  { folder: "services/platform-reference/migrations", table: "platform_reference_migrations" },
] as const;
