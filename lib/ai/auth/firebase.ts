/**
 * lib/ai/auth/firebase.ts
 *
 * Server-side Firebase Authentication for Phase 3.
 *
 * Production identity is established exclusively from a Bearer ID token,
 * verified with the Firebase Admin SDK. The client can NEVER impersonate
 * another user by changing a header, a body field, a query parameter, or a
 * model-supplied value — those are ignored on security-sensitive paths.
 *
 * Offline testability: the real Admin verification path is lazily imported
 * (so merely importing this module never initializes the Admin SDK), and the
 * verifier is injectable via `setTokenVerifier`. Tests inject a mock verifier
 * that returns crafted decoded tokens and never touch a real Firebase project.
 */

import { NextRequest } from "next/server";
import type { AuthenticatedUser, Claims, Role } from "./types";

/**
 * Thrown for any authentication/authorization failure at the HTTP layer.
 * `status` is the HTTP code to return; `code` is a stable machine identifier.
 */
export class AuthError extends Error {
  public readonly status: 401 | 403 | 500;
  public readonly code: string;

  constructor(status: 401 | 403 | 500, code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

/** A decoded Firebase ID token, as returned by `verifyIdToken`. */
export interface DecodedIdTokenLike {
  uid: string;
  email?: string | null;
  email_verified?: boolean;
  [key: string]: unknown;
}

/**
 * Injectable token verifier. Production uses the Firebase Admin SDK; tests
 * inject a fake that returns controlled decoded tokens.
 */
export interface TokenVerifier {
  verify(idToken: string): Promise<DecodedIdTokenLike>;
}

let verifier: TokenVerifier | null = null;

function logVerificationFailure(code: string): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[firebase-auth] token verification failed: ${code}`);
  }
}

/** Install a (mock) verifier — used by the offline test harness. */
export function setTokenVerifier(v: TokenVerifier | null): void {
  verifier = v;
}

/** Reset to the production Admin-based verifier (no-op in offline tests). */
export function resetTokenVerifier(): void {
  verifier = null;
}

/** Production verifier: validates the ID token with Firebase Admin. */
async function adminVerifyIdToken(idToken: string): Promise<DecodedIdTokenLike> {
  // Lazy import: avoids initializing the Admin SDK at module load time, which
  // keeps offline test bundles working without Firebase env present.
  const [{ adminApp }, { getAuth }] = await Promise.all([
    import("@/lib/firebase-admin"),
    import("firebase-admin/auth"),
  ]);
  return getAuth(adminApp).verifyIdToken(idToken) as Promise<DecodedIdTokenLike>;
}

/** Resolve the verifier to use: injected mock (tests) or Admin (production). */
export async function verifyIdToken(idToken: string): Promise<AuthenticatedUser> {
  const v: TokenVerifier = verifier ?? { verify: adminVerifyIdToken };
  try {
    const decoded = await v.verify(idToken);
    if (!decoded || typeof decoded.uid !== "string" || !decoded.uid) {
      throw new AuthError(
        401,
        "AUTH_TOKEN_INVALID",
        "ID token payload is missing a valid uid."
      );
    }
    return toAuthenticatedUser(decoded);
  } catch (e) {
    if (e instanceof AuthError) throw e;
    const raw = e as { code?: string; message?: string };
    const code = raw?.code ?? raw?.message ?? "unknown";
    if (code === "opsflow/admin-config") {
      logVerificationFailure(code);
      throw new AuthError(
        500,
        "AUTH_SERVER_MISCONFIGURED",
        "Authentication service is not configured."
      );
    }
    logVerificationFailure(code);
    // Firebase Auth error codes for expiry / invalid tokens.
    if (
      code === "auth/id-token-expired" ||
      code === "auth/session-cookie-expired" ||
      /expir/i.test(code)
    ) {
      throw new AuthError(401, "AUTH_TOKEN_EXPIRED", "ID token has expired.");
    }
    throw new AuthError(401, "AUTH_TOKEN_INVALID", "Invalid ID token.");
  }
}

/** Convert a decoded token into the trusted typed user used by OpsFlow. */
export function toAuthenticatedUser(
  decoded: DecodedIdTokenLike
): AuthenticatedUser {
  const claims =
    (decoded as { claims?: Claims }).claims ??
    ((decoded as { [k: string]: unknown }) as Claims);

  const rawEmail = decoded.email;
  const email = typeof rawEmail === "string" ? rawEmail : null;
  const emailVerified = decoded.email_verified === true;
  const admin = claims.admin === true;

  const role: Role = admin ? "admin" : "user";

  return {
    uid: decoded.uid,
    email,
    emailVerified,
    claims: claims as Claims,
    role,
    admin,
  };
}

/**
 * Extract a bearer token from the request and verify it.
 *
 * Rejects:
 *  - missing Authorization header          → 401 AUTH_MISSING_TOKEN
 *  - malformed Authorization header        → 401 AUTH_MISSING_TOKEN
 *  - empty bearer token                    → 401 AUTH_MISSING_TOKEN
 *  - invalid / unverifiable token          → 401 AUTH_TOKEN_INVALID
 *  - expired token                         → 401 AUTH_TOKEN_EXPIRED
 *
 * The `x-opsflow-user-id` header and any `userId` in the body/query are
 * deliberately NOT consulted here — they are not security signals.
 */
export async function getAuthenticatedUser(
  req: NextRequest
): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new AuthError(
      401,
      "AUTH_MISSING_TOKEN",
      "Authentication required. Provide an Authorization: Bearer <idToken> header."
    );
  }
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new AuthError(
      401,
      "AUTH_MALFORMED_TOKEN",
      "Authentication required. Use the Bearer token scheme."
    );
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    throw new AuthError(
      401,
      "AUTH_MISSING_TOKEN",
      "Authentication required. The bearer token is empty."
    );
  }

  return verifyIdToken(idToken);
}

/** Alias used by routes that want a clearly-named "require an auth'd user" step. */
export async function requireAuthenticated(
  req: NextRequest
): Promise<AuthenticatedUser> {
  return getAuthenticatedUser(req);
}
