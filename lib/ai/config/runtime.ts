export function runtimeStatus() {
  return {
    aiProvider: process.env.AI_PROVIDER ?? "ollama",
    environment: process.env.NODE_ENV ?? "unknown",
    firebaseAdminConfigured: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY),
  };
}

export function isDevelopmentTestRouteAllowed(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ALLOW_TEST_ROUTES === "true";
}