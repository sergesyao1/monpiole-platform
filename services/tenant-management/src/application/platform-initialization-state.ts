export interface PlatformTenantInitializationState {
  hasAnyTenant(): Promise<boolean>;
}
