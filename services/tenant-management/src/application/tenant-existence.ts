export interface TenantExistenceRepository {
  exists(tenantId: string): Promise<boolean>;
}

export class CheckTenantExists {
  constructor(private readonly tenants: TenantExistenceRepository) {}

  execute(tenantId: string): Promise<boolean> {
    return this.tenants.exists(tenantId);
  }
}
