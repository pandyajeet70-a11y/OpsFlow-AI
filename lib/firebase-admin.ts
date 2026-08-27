import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

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

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

export { adminApp };

export const adminDb = getFirestore(adminApp);