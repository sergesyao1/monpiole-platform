import { BadRequestException } from "@nestjs/common";

export interface SafeValidationError {
  readonly path: string;
  readonly code: "invalid" | "missing" | "not-applicable";
}

export class TransportValidationException extends BadRequestException {
  constructor(readonly safeErrors: readonly SafeValidationError[]) {
    super("Invalid request");
  }
}
