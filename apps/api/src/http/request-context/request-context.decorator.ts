import { SetMetadata } from "@nestjs/common";

export const TENANT_CONTEXT_METADATA = "monpiole:tenant-context";
export const IDEMPOTENCY_METADATA = "monpiole:idempotency";

export type TenantContextRequirement =
  | "required"
  | "optional"
  | "not-applicable";

export const TenantContext = (requirement: TenantContextRequirement) =>
  SetMetadata(TENANT_CONTEXT_METADATA, requirement);

export const Idempotency = (requirement: "required" | "optional") =>
  SetMetadata(IDEMPOTENCY_METADATA, requirement);
