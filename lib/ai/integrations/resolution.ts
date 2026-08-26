export type IntegrationRuntimeMode = "configured" | "mock";

export function resolveIntegrationMode(enabled: boolean, credentialsAvailable: boolean): IntegrationRuntimeMode {
  return enabled && credentialsAvailable ? "configured" : "mock";
}