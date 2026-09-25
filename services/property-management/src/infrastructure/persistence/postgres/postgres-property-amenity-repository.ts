import { withTenantPostgresTransaction } from "@monpiole/persistence";
import type { Pool } from "pg";
import type { PropertyAmenityRepository } from "../../../application/property-amenities.js";
import type { AmenityCode } from "../../../domain/property-amenity.js";

export class PostgresPropertyAmenityRepository implements PropertyAmenityRepository {
  constructor(private readonly pool: Pool) {}
  findCodes(tenantId: string, propertyId: string): Promise<readonly AmenityCode[] | undefined> { return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
    const property = await scope.query("SELECT 1 FROM property_management.properties WHERE tenant_id=$1::uuid AND property_id=$2::uuid", [tenantId, propertyId]); if (property.length === 0) return undefined;
    const rows = await scope.query<{ amenity_code: AmenityCode }>("SELECT amenity_code FROM property_management.property_amenities WHERE tenant_id=$1::uuid AND property_id=$2::uuid ORDER BY amenity_code", [tenantId, propertyId]); return rows.map((row) => row.amenity_code);
  }); }
  replace(tenantId: string, propertyId: string, codes: readonly AmenityCode[], trace: { actorId: string; correlationId: string; updatedAt: string }): Promise<readonly AmenityCode[] | undefined> { return withTenantPostgresTransaction(this.pool, tenantId, async (scope) => {
    const property = await scope.query("SELECT 1 FROM property_management.properties WHERE tenant_id=$1::uuid AND property_id=$2::uuid FOR UPDATE", [tenantId, propertyId]); if (property.length === 0) return undefined;
    await scope.query("DELETE FROM property_management.property_amenities WHERE tenant_id=$1::uuid AND property_id=$2::uuid", [tenantId, propertyId]);
    for (const code of codes) await scope.query("INSERT INTO property_management.property_amenities (tenant_id,property_id,amenity_code,updated_at,correlation_id,actor_id) VALUES ($1::uuid,$2::uuid,$3,$4::timestamptz,$5::uuid,$6)", [tenantId, propertyId, code, trace.updatedAt, trace.correlationId, trace.actorId]); return [...codes].sort();
  }); }
}
