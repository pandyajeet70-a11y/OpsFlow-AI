/**
 * app/api/ai/generate/route.ts
 *
 * Public entry point for OpsFlow AI.
 *
 * Request flow:
 *
 * Client
 *   ↓
 * /api/ai/generate
 *   ↓
 * validation
 *   ↓
 * orchestrator
 *   ↓
 * specialized agent
 *   ↓
 * active AI provider
 *   ↓
 * Ollama / OpenAI
 */

import { NextRequest, NextResponse } from "next/server";

import {
  orchestrate,
  previewRouting,
} from "@/lib/ai/agents/orchestrator";

import {
  AIError,
  type AIGenerateRequest,
  type AIErrorCode,
} from "@/lib/ai/types";

import {
  getAuthenticatedUser,
  authErrorResponse,
} from "@/lib/ai/approvals/auth";
import {
  getOrCreateOrganizationForUser,
  initDefaultOrgStore,
} from "@/lib/ai/org";
import { defaultOrgServiceDeps, getOrCreateOrganizationForUser as resolveOrganization } from "@/lib/ai/org/service";
import { resolveAuthorizationContext } from "@/lib/ai/auth/authorization-server";
import {
  getDefaultAuditService,
  initDefaultAuditStore,
} from "@/lib/ai/audit";

// Initialize the production OrgStore for this server process (server-only).
initDefaultOrgStore();
// Initialize the production Firestore audit store for this server process.
initDefaultAuditStore();

export const runtime = "nodejs";

const MAX_PROMPT_LENGTH = 8_000;
const MAX_SYSTEM_LENGTH = 2_000;
const REQUEST_TIMEOUT_MS =
  Number(process.env.AI_TIMEOUT_MS) || 30_000;

interface RawRequestBody {
  prompt?: unknown;
  system?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  agentId?: unknown;
  preview?: unknown;
}

/* =========================================================
   Error → HTTP Status
   ========================================================= */

function statusForErrorCode(code: AIErrorCode): number {
  switch (code) {
    case "INVALID_REQUEST":
      return 400;

    case "PROVIDER_AUTH_ERROR":
      return 502;

    case "PROVIDER_TIMEOUT":
      return 504;

    case "PROVIDER_UNAVAILABLE":
      return 503;

    case "CONFIG_ERROR":
      return 500;

    case "PROVIDER_ERROR":
    default:
      return 502;
  }
}

/* =========================================================
   Request Validation
   ========================================================= */

function validateBody(body: RawRequestBody): AIGenerateRequest {
  if (
    typeof body.prompt !== "string" ||
    body.prompt.trim().length === 0
  ) {
    throw new AIError(
      "INVALID_REQUEST",
      "`prompt` is required and must be a non-empty string."
    );
  }

  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    throw new AIError(
      "INVALID_REQUEST",
      `\`prompt\` must be ${MAX_PROMPT_LENGTH} characters or fewer.`
    );
  }

  if (body.system !== undefined) {
    if (typeof body.system !== "string") {
      throw new AIError(
        "INVALID_REQUEST",
        "`system` must be a string if provided."
      );
    }

    if (body.system.length > MAX_SYSTEM_LENGTH) {
      throw new AIError(
        "INVALID_REQUEST",
        `\`system\` must be ${MAX_SYSTEM_LENGTH} characters or fewer.`
      );
    }
  }

  if (body.temperature !== undefined) {
    if (
      typeof body.temperature !== "number" ||
      Number.isNaN(body.temperature)
    ) {
      throw new AIError(
        "INVALID_REQUEST",
        "`temperature` must be a number if provided."
      );
    }

    if (
      body.temperature < 0 ||
      body.temperature > 2
    ) {
      throw new AIError(
        "INVALID_REQUEST",
        "`temperature` must be between 0 and 2."
      );
    }
  }

  if (body.maxTokens !== undefined) {
    if (
      typeof body.maxTokens !== "number" ||
      !Number.isInteger(body.maxTokens) ||
      body.maxTokens <= 0
    ) {
      throw new AIError(
        "INVALID_REQUEST",
        "`maxTokens` must be a positive integer if provided."
      );
    }

    if (body.maxTokens > 4_000) {
      throw new AIError(
        "INVALID_REQUEST",
        "`maxTokens` must be 4000 or fewer."
      );
    }
  }

  return {
    prompt: body.prompt,
    system:
      body.system as string | undefined,
    temperature:
      body.temperature as number | undefined,
    maxTokens:
      body.maxTokens as number | undefined,
  };
}

/* =========================================================
   POST /api/ai/generate
   ========================================================= */

export async function POST(req: NextRequest) {
  let authorization;
  try {
    authorization = await resolveAuthorizationContext(req);
  } catch (error) {
    return authErrorResponse(error);
  }
  let rawBody: RawRequestBody;

  /* -------------------------------------------------------
     Parse JSON
     ------------------------------------------------------- */

  try {
    rawBody = (await req.json()) as RawRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 }
    );
  }

  /* -------------------------------------------------------
     Validate request
     ------------------------------------------------------- */

  let validated: AIGenerateRequest;

  try {
    validated = validateBody(rawBody);
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.publicMessage,
          },
        },
        {
          status: statusForErrorCode(err.code),
        }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid request body.",
        },
      },
      { status: 400 }
    );
  }

  /* -------------------------------------------------------
     Optional routing preview
     ------------------------------------------------------- */

  if (rawBody.preview === true) {
    const routing = previewRouting(validated.prompt);

    return NextResponse.json(
      {
        data: {
          routing,
        },
      },
      { status: 200 }
    );
  }

  /* -------------------------------------------------------
     Validate optional agent ID
     ------------------------------------------------------- */

  let agentId: string | undefined;

  if (rawBody.agentId !== undefined) {
    if (typeof rawBody.agentId !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "`agentId` must be a string if provided.",
          },
        },
        { status: 400 }
      );
    }

    agentId = rawBody.agentId;
  }

  /* -------------------------------------------------------
     Request id (correlation across the whole call). Minted before
     authentication so denied-auth attempts can also be correlated.
     ------------------------------------------------------- */

  const requestId = `req_${crypto.randomUUID()}`;

  /* -------------------------------------------------------
     Authenticate caller (Phase 3)
     ------------------------------------------------------- */

  const user = authorization.user;

  // Resolve the caller's active organization. The org id is a server-controlled
  // value: it is NEVER taken from the request body or the model.
  const activeOrg = { organizationId: authorization.organizationId, role: authorization.role };
  const userId = user.uid;
  const organizationId = activeOrg.organizationId;

  getDefaultAuditService().fire("ai_request_received", {
    eventType: "ai_request_received",
    requestId,
    userId,
    organizationId,
    agentId,
    success: true,
    status: "received",
    metadata: {
      promptLength: validated.prompt.length,
      routing: agentId ? "explicit" : "automatic",
    },
  });

  /* -------------------------------------------------------
     Request timeout
     ------------------------------------------------------- */

  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  /* -------------------------------------------------------
     Orchestrate
     ------------------------------------------------------- */

  try {
    const result = await orchestrate(
      {
        prompt: validated.prompt,
        context: validated.system,
        temperature: validated.temperature,
        maxTokens: validated.maxTokens,
        agentId,
        requestId,
        userId,
        organizationId,
        organizationRole: activeOrg.role,
        isAdmin: user.admin,
      },
      controller.signal
    );

    const responseBody: Record<string, unknown> = {
      text: result.response.text,
      requestId,
      agent: {
        id: result.agentId,
      },
      routing: result.routing,
      provider: result.response.provider,
      model: result.response.model,
      metadata: result.response.metadata,
    };

    if (result.response.tool) {
      responseBody.tool = {
        id: result.response.tool.id,
        toolId: result.response.tool.toolId,
        executed: result.response.tool.executed,
        status: result.response.tool.status,
        approvalRequired: result.response.tool.approvalRequired,
        requestId: result.response.tool.requestId,
        agentId: result.response.tool.agentId,
        ...(result.response.tool.approvalId && {
          approvalId: result.response.tool.approvalId,
        }),
        ...(result.response.tool.result !== undefined && {
          result: result.response.tool.result,
        }),
        ...(result.response.tool.error && {
          error: result.response.tool.error,
        }),
      };
    }

    getDefaultAuditService().fire("ai_request_completed", {
      eventType: "ai_request_completed",
      requestId,
      userId,
      organizationId,
      agentId: result.agentId,
      success: true,
      status: "completed",
      metadata: {
        provider: result.response.provider,
        model: result.response.model,
        responseLength: result.response.text.length,
        toolStatus: result.response.tool?.status,
      },
    });

    return NextResponse.json(
      {
        data: responseBody,
      },
      { status: 200 }
    );
  } catch (err) {
    getDefaultAuditService().fire("ai_request_failed", {
      eventType: "ai_request_failed",
      requestId,
      userId,
      organizationId,
      success: false,
      status: "failed",
      metadata: {
        errorType:
          err instanceof AIError
            ? err.code
            : err instanceof Error
              ? err.name
              : "unknown",
      },
    });

    if (err instanceof AIError) {
      console.error(
        `[ai/generate] ${err.code}: ${err.message}`
      );

      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.publicMessage,
          },
        },
        {
          status: statusForErrorCode(err.code),
        }
      );
    }

    if (
      err instanceof Error &&
      err.name === "AbortError"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_TIMEOUT",
            message: "AI request timed out.",
          },
        },
        { status: 504 }
      );
    }

    console.error(
      "[ai/generate] Unexpected error:",
      err
    );

    return NextResponse.json(
      {
        error: {
          code: "PROVIDER_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}