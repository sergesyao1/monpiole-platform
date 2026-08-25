import type { ContractBaselineRequest } from "../../contracts/v1/contract-baseline/contract-baseline.schema.js";

export interface ContractBaselineInput {
  readonly message: string;
}

export function toContractBaselineInput(
  request: ContractBaselineRequest,
): ContractBaselineInput {
  return { message: request.message };
}
