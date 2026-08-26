/**
 * lib/ai/approvals/auth.ts
 *
 * Phase 3 server-side caller-identity resolution.
 *
 * SECURITY: Identity is established EXCLUSIVELY from a Firebase ID token sent
 * in `Authorization: Bearer <idToken>`, verified with the Firebase Admin SDK.
 *
 * The following client-supplied values are deliberately NEVER trusted on these
 * security-sensitive paths:
 *  - `x-opsflow-user-id` header
 *  - `userId` in the JSON body
 *  - `userId` from query parameters
 *  - `userId` supplied by the AI model
 *
 * Those cannot be used to impersonate another user, because the UID is always
 * taken from the verified token payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthError, getAuthenticatedUser } from "../auth/firebase";
import type { AuthenticatedUser } from "../auth/types";

export { AuthError, getAuthenticatedUser } from "../auth/firebase";
export type { AuthenticatedUser } from "../auth/types";

/**
 * Authenticate a NextRequest, throwing `AuthError` (401) for missing/invalid/
 * expired tokens. The returned `AuthenticatedUser` carries the verified UID,
 * email, email-verified flag, and claims — and nothing client-supplied.
 */
export async function getCallerIdentity(
  req: NextRequest
): Promise<AuthenticatedUser> {
  return getAuthenticatedUser(req);
}

/**
 * Resolve the actor UID from a *verified* token.
 *
 * Returns undefined only when there is no authenticated caller — callers should
 * treat that as 401. This name is retained for minimal diff against existing
 * route call-sites, but it now delegates to strict token verification and
 * ignores `x-opsflow-user-id` / body `userId`.
 */
export async function getCallerUserId(req: NextRequest): Promise<string | undefined> {
  const user = await getAuthenticatedUser(req);
  return user.uid;
}

/**
 * Map an `AuthError` (thrown by `getAuthenticatedUser`) to an HTTP response.
 *
 *   401 → { ok: false, code, message }
 *   403 → { ok: false, code, message }
 */
export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status }
    );
  }

  // Unknown errors are never leaked as auth details.
  return NextResponse.json(
    {
      error: {
        code: "AUTH_ERROR",
        message: "Authentication failed.",
      },
    },
    { status: 401 }
  );
}
