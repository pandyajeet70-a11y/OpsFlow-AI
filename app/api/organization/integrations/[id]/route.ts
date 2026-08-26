import { NextRequest, NextResponse } from "next/server";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";
import { getIntegrationConfig, saveIntegrationConfig, toPublicIntegration } from "@/lib/ai/integrations/config";
import { isProviderConfigured } from "@/lib/ai/integrations/providers";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePermission(request, "view_integrations");
    const config = await getIntegrationConfig(context.organizationId, (await params).id);
    if (!config) return NextResponse.json({ error: "Integration not found." }, { status: 404 });
    return NextResponse.json({ data: { ...toPublicIntegration(context.organizationId, config), configured: config.enabled && isProviderConfigured(config.provider) } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[organization/integrations] get failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to load integration." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePermission(request, "manage_organization");
    const id = (await params).id;
    const current = await getIntegrationConfig(context.organizationId, id);
    if (!current) return NextResponse.json({ error: "Integration not found." }, { status: 404 });
    const body = await request.json() as { name?: string; enabled?: boolean; metadata?: Record<string, unknown> };
    await saveIntegrationConfig(context.organizationId, { ...current, id, name: typeof body.name === "string" ? body.name.slice(0, 100) : current.name, enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled, metadata: body.metadata ? sanitizeMetadata(body.metadata) : current.metadata }, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[organization/integrations] update failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to update integration." }, { status: 500 });
  }
}

function sanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => !/(secret|token|password|api.?key|credential)/i.test(key) && ["string", "number", "boolean"].includes(typeof item)).slice(0, 20));
}