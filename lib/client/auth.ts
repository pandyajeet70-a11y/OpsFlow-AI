/**
 * lib/client/auth.ts
 *
 * Client-side bridge between the existing Firebase Auth UI and the protected
 * OpsFlow API (Phase 3).
 *
 * The AuthGuard already ensures the dashboard only renders for a signed-in
 * Firebase user. This module provides the small, safe wrapper that turns the
 * Firebase session into a verified Bearer ID token for every protected API
 * request — so the server can run `verifyIdToken` and trust the caller.
 *
 * It deliberately does NOT add new state management or UI; it only attaches the
 * token. Replace a plain `fetch("/api/...")` with `authFetch(...)` to call a
 * protected route.
 */

import { getIdToken, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Resolve the current user's Firebase ID token, forcing a refresh so the
 * server always sees fresh custom claims (e.g. a newly granted `admin` role).
 */
export async function getBearerToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No authenticated user. Please sign in.");
  }
  return getIdToken(currentUser, /* forceRefresh */ true);
}

/**
 * Subscribe to auth-state changes (used by the existing AuthGuard/AppShell).
 */
export function onUserChanged(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export interface AuthFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * fetch() wrapper that automatically attaches `Authorization: Bearer <idToken>`
 * to requests against `/api/` (relative URLs), unless `skipAuth` is set.
 *
 * Non-/api/ URLs (e.g. Next.js RSC) are passed through untouched.
 */
export async function authFetch(
  input: string | URL | Request,
  init?: AuthFetchOptions
): Promise<Response> {
  const isApi =
    typeof input === "string" && (input.startsWith("/api/") || input.startsWith("http"));

  if (isApi && !init?.skipAuth && !auth.currentUser) {
    return new Response(
      JSON.stringify({
        error: {
          code: "UNAUTHENTICATED",
          message: "You must be signed in to access this resource.",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = new Headers(init?.headers);
  if (isApi && !init?.skipAuth && !headers.has("authorization")) {
    try {
      const token = await getBearerToken();
      headers.set("authorization", `Bearer ${token}`);
    } catch {
      // Fall through: the server will reject the unauthenticated request.
    }
  }

  return fetch(input, { ...init, headers });
}
