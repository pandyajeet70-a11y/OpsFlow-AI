import { NextRequest, NextResponse } from "next/server";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";
import { getIntegrationConfig, updateIntegrationTestedAt } from "@/lib/ai/integrations/config";
import { isProviderConfigured } from "@/lib/ai/integrations/providers";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePermission(request, "manage_organization");
    const id = (await params).id;
    const config = await getIntegrationConfig(context.organizationId, id);
    if (!config) return NextResponse.json({ error: "Integration not found." }, { status: 404 });
    await updateIntegrationTestedAt(context.organizationId, id);
    return NextResponse.json({ data: { status: config.enabled && isProviderConfigured(config.provider) ? "configured" : "mock", tested: true } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[organization/integrations] test failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to test integration." }, { status: 500 });
  }
}