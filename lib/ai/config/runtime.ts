export function runtimeStatus() {
  return {
    aiProvider: process.env.AI_PROVIDER ?? "ollama",
    firebaseAdminConfigured: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    integrationCredentials: {
      webhook: Boolean(process.env.WEBHOOK_SECRET),
      email: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
      crm: Boolean(process.env.CRM_API_URL && process.env.CRM_API_KEY),
    },
  };
}