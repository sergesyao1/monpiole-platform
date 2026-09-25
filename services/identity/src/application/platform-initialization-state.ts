export interface PlatformIdentityInitializationState {
  hasAnyIdentityOrMembership(): Promise<boolean>;
}
