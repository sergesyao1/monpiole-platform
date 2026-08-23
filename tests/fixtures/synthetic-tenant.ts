export interface SyntheticTenantOwner {
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface SyntheticTenantFixture {
  readonly fixtureId: string;
  readonly owner: SyntheticTenantOwner;
  readonly label: string;
}

export function createSyntheticTenantFixture(
  owner: SyntheticTenantOwner,
  sequence: number,
): SyntheticTenantFixture {
  if (owner.tenantId.length === 0 || owner.correlationId.length === 0) {
    throw new Error("Synthetic fixtures require explicit tenant and correlation identifiers.");
  }

  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Synthetic fixture sequence must be a positive safe integer.");
  }

  return Object.freeze({
    fixtureId: `${owner.tenantId}-fixture-${sequence}`,
    owner: Object.freeze({ ...owner }),
    label: `Synthetic tenant fixture ${sequence}`,
  });
}
