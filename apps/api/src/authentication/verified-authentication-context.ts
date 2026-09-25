export interface VerifiedAuthenticationContext {
  readonly issuer: string;
  readonly subject: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly authenticatedAt?: string;
  readonly authenticationMethods: readonly string[];
}
