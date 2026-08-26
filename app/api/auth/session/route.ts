/**
 * app/api/auth/session/route.ts
 *
 * Phase 3 identity bootstrap endpoint.
 *
 * After a client signs in/up with Firebase Auth, the client calls this route
 * with its freshly minted ID token. The server:
 *  1. Verifies the ID token with Firebase Admin (establishing server-verified
 *     identity — not `x-opsflow-user-id`, not the model, not the body).
 *  2. Resolves (or lazily creates) the user's organization + membership.
 *  3. Returns the verified uid, email, role, and `organizationId`.
 *
 * This is the single place that turns a client-held Firebase session into a
 * server-trusted actor context, so every other route that needs tenant context
 * can derive it from a verified token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, authErrorResponse, AuthError } from "@/lib/ai/approvals/auth";
import { getOrCreateOrganizationForUser, initDefaultOrgStore } from "@/lib/ai/org";
import { defaultOrgServiceDeps } from "@/lib/ai/org/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

initDefaultOrgStore();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getAuthenticatedUser(req);

    const orgService = defaultOrgServiceDeps();
    const activeOrg = await getOrCreateOrganizationForUser(orgService, user);

    return NextResponse.json({
      data: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        organizationId: activeOrg.organizationId,
        organizationRole: activeOrg.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("[auth/session]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to establish session." } },
      { status: 500 }
    );
  }
}
