export interface VerifiedAuthenticationContext {
  readonly issuer: string;
  readonly subject: string;
  readonly authenticatedAt?: string;
  readonly authenticationMethods: readonly string[];
}
