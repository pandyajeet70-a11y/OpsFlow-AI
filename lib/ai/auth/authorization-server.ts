import { NextRequest, NextResponse } from "next/server";
import { AuthError, getAuthenticatedUser } from "../auth/firebase";
import type { AuthenticatedUser } from "../auth/types";
import { getOrCreateOrganizationForUser, initDefaultOrgStore } from "../org";
import { defaultOrgServiceDeps } from "../org/service";
import type { OrgRole } from "./types";

export type Permission =
  | "view_workflows"
  | "create_leads"
  | "create_handoffs"
  | "manage_handoffs"
  | "manage_onboarding"
  | "approve_actions"
  | "retry_actions"
  | "manage_organization"
  | "view_integrations"
  | "manage_members"
  | "view_audit";

export interface AuthorizationContext {
  userId: string;
  email: string | null;
  organizationId: string;
  role: OrgRole;
  user: AuthenticatedUser;
}

const permissionMap: Record<OrgRole, readonly Permission[]> = {
  owner: ["view_workflows", "create_leads", "create_handoffs", "manage_handoffs", "manage_onboarding", "approve_actions", "retry_actions", "manage_organization", "view_integrations", "manage_members", "view_audit"],
  admin: ["view_workflows", "create_leads", "create_handoffs", "manage_handoffs", "manage_onboarding", "approve_actions", "retry_actions", "manage_organization", "view_integrations", "manage_members", "view_audit"],
  sales: ["view_workflows", "create_leads", "create_handoffs", "manage_handoffs"],
  customer_success: ["view_workflows", "manage_onboarding", "retry_actions", "view_audit"],
  viewer: ["view_workflows", "view_audit", "view_integrations"],
  member: ["view_workflows"],
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return permissionMap[role]?.includes(permission) ?? false;
}

export async function resolveAuthorizationContext(
  request: NextRequest
): Promise<AuthorizationContext> {
  initDefaultOrgStore();
  const user = await getAuthenticatedUser(request);
  const active = await getOrCreateOrganizationForUser(defaultOrgServiceDeps(), user);
  const role = active.role === "member" ? "viewer" : active.role;
  return {
    userId: user.uid,
    email: user.email,
    organizationId: active.organizationId,
    role,
    user,
  };
}

export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<AuthorizationContext> {
  const context = await resolveAuthorizationContext(request);
  if (!context.user.admin && !hasPermission(context.role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return context;
}

export function authorizationErrorResponse(error: unknown): NextResponse {
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (error instanceof AuthError) {
    if (error.status === 500) {
      return NextResponse.json({ error: "Authentication service unavailable." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export function isAuthorizationError(error: unknown): boolean {
  return error instanceof AuthError || (error instanceof Error && error.message === "FORBIDDEN");
}
