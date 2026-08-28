import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  if (!cleaned) return undefined;
  return cleaned.replace(/^("[\s\S]*"|'[\s\S]*')$/, (quoted) => quoted.slice(1, -1));
}

const projectId = cleanEnvValue(process.env.FIREBASE_ADMIN_PROJECT_ID);
const clientEmail = cleanEnvValue(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
const privateKey = cleanEnvValue(process.env.FIREBASE_ADMIN_PRIVATE_KEY)
  ?.replace(/\\n/g, "\n")
  .replace(/\r\n/g, "\n")
  .trim();
const clientProjectId = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

if (
  !projectId ||
  !clientEmail ||
  !privateKey ||
  !clientEmail.includes("@") ||
  !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
  !privateKey.includes("-----END PRIVATE KEY-----") ||
  (clientProjectId && clientProjectId !== projectId)
) {
  const error = new Error("Firebase Admin credentials are not configured.") as Error & { code: string };
  error.code = "opsflow/admin-config";
  throw error;
}

let adminApp: App;
try {
  adminApp =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
} catch (error) {
  const cause = error as { message?: string };
  const configError = new Error(
    process.env.NODE_ENV === "development"
      ? `Firebase Admin initialization failed: ${cause.message ?? "unknown error"}`
      : "Firebase Admin credentials are not configured."
  ) as Error & { code: string };
  configError.code = "opsflow/admin-config";
  throw configError;
}

export { adminApp };

export const adminDb = getFirestore(adminApp);