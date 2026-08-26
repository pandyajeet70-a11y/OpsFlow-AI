import { NextRequest, NextResponse } from "next/server";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";
import { listIntegrationConfigs, saveIntegrationConfig, toPublicIntegration } from "@/lib/ai/integrations/config";
import { isProviderConfigured } from "@/lib/ai/integrations/providers";
import type { IntegrationProvider } from "@/lib/ai/integrations/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_integrations");
    const data = (await listIntegrationConfigs(context.organizationId)).map((config) => ({ ...toPublicIntegration(context.organizationId, config), configured: config.enabled && isProviderConfigured(config.provider) }));
    return NextResponse.json({ data });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[organization/integrations]", error);
    return NextResponse.json({ error: "Unable to load integrations." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePermission(request, "manage_organization");
    const body = await request.json() as { provider?: IntegrationProvider; name?: string; enabled?: boolean; metadata?: Record<string, unknown> };
    if (!body.provider || !["webhook", "email", "crm"].includes(body.provider)) return NextResponse.json({ error: "A supported integration provider is required." }, { status: 400 });
    const id = await saveIntegrationConfig(context.organizationId, { provider: body.provider, name: typeof body.name === "string" ? body.name.slice(0, 100) : body.provider, enabled: body.enabled === true, metadata: sanitizeMetadata(body.metadata) });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[organization/integrations] create failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to save integration." }, { status: 500 });
  }
}

function sanitizeMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => !/(secret|token|password|api.?key|credential)/i.test(key) && ["string", "number", "boolean"].includes(typeof item)).slice(0, 20));
}
