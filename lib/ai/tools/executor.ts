/**
 * lib/ai/tools/executor.ts
 *
 * Central execution layer for OpsFlow tools.
 *
 * Flow:
 *
 * Agent
 *   ↓
 * Tool Executor
 *   ↓
 * Tool Registry
 *   ↓
 * Tool
 *   ↓
 * Result
 */

import {
  validateToolInput,
} from "./schema";
import { getTool } from "./registry";
import "./builtins";
import { createApproval } from "../approvals/service";
import { getDefaultApprovalStore } from "../approvals/firestore-store";
import { getDefaultAuditService } from "../audit";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types";

export interface ExecuteToolRequest {
  toolId: string;
  input: Record<string, unknown>;
  context?: ToolExecutionContext;
}

/* =========================================================
   Execute Tool
   ========================================================= */

export async function executeTool(
  request: ExecuteToolRequest
): Promise<ToolExecutionResult> {
  if (
    typeof request.toolId !== "string" ||
    request.toolId.trim().length === 0
  ) {
    throw new Error("A valid toolId is required.");
  }
  if (
    !request.input ||
    typeof request.input !== "object" ||
    Array.isArray(request.input)
  ) {
    throw new Error("Tool input must be an object.");
  }

  const tool = getTool(request.toolId);

  if (!tool) {
    getDefaultAuditService().fire("tool_failed", {
      eventType: "tool_failed",
      requestId: request.context?.requestId,
      userId: request.context?.userId,
      organizationId: request.context?.organizationId,
      agentId: request.context?.agentId,
      toolId: request.toolId,
      success: false,
      status: "unregistered",
    });
    return {
      success: false,
      toolId: request.toolId,
      toolName: request.toolId,
      executed: false,
      status: "failed",
      result: null,
      durationMs: 0,
      approvalRequired: false,
      error: `Tool "${request.toolId}" is not registered.`,
      requestId: request.context?.requestId,
      agentId: request.context?.agentId,
      userId: request.context?.userId,
    };
  }

  const approvalRequired = tool.requiresApproval === true;
  const approved = request.context?.approved === true;

  if (approvalRequired && !approved) {
    let approvalId: string | undefined;

    try {
      const approval = await createApproval(
        { store: getDefaultApprovalStore() },
        {
          requestId: request.context?.requestId ?? `req_${Date.now()}`,
          userId: request.context?.userId,
          organizationId: request.context?.organizationId,
          agentId: request.context?.agentId,
          toolId: tool.id,
          toolName: tool.name,
          arguments: request.input,
        }
      );
      approvalId = approval.approvalId;
      getDefaultAuditService().fire("approval_created", {
        eventType: "approval_created",
        requestId: request.context?.requestId,
        userId: request.context?.userId,
        organizationId: request.context?.organizationId,
        agentId: request.context?.agentId,
        toolId: tool.id,
        approvalId,
        success: true,
        status: "requires_approval",
      });
    } catch (error) {
      console.error(
        `[tool-executor] failed to persist approval for "${tool.id}":`,
        error
      );
    }

    return {
      success: false,
      toolId: tool.id,
      toolName: tool.name,
      executed: false,
      status: "requires_approval",
      result: null,
      durationMs: 0,
      approvalRequired: true,
      approvalId,
      error: `Tool "${tool.id}" requires approval before execution.`,
      requestId: request.context?.requestId,
      agentId: request.context?.agentId,
      userId: request.context?.userId,
    };
  }

  const validation = validateToolInput(tool.inputSchema, request.input);
  if (!validation.valid) {
    getDefaultAuditService().fire("tool_failed", {
      eventType: "tool_failed",
      requestId: request.context?.requestId,
      userId: request.context?.userId,
      organizationId: request.context?.organizationId,
      agentId: request.context?.agentId,
      toolId: tool.id,
      success: false,
      status: "invalid_arguments",
    });
    return {
      success: false,
      toolId: tool.id,
      toolName: tool.name,
      executed: false,
      status: "failed",
      result: null,
      durationMs: 0,
      approvalRequired,
      error: `Invalid arguments for "${tool.id}": ${validation.errors.join(" ")}`,
      requestId: request.context?.requestId,
      agentId: request.context?.agentId,
      userId: request.context?.userId,
    };
  }

  const startedAt = Date.now();

  getDefaultAuditService().fire("tool_execution_started", {
    eventType: "tool_execution_started",
    requestId: request.context?.requestId,
    userId: request.context?.userId,
    organizationId: request.context?.organizationId,
    agentId: request.context?.agentId,
    toolId: tool.id,
    success: true,
    status: "started",
  });

  try {
    const result = await tool.execute(
      validation.data,
      request.context
    );

    getDefaultAuditService().fire("tool_executed", {
      eventType: "tool_executed",
      requestId: request.context?.requestId,
      userId: request.context?.userId,
      organizationId: request.context?.organizationId,
      agentId: request.context?.agentId,
      toolId: tool.id,
      success: true,
      status: "completed",
      metadata: { durationMs: Date.now() - startedAt },
    });
    return {
      success: true,
      toolId: tool.id,
      toolName: tool.name,
      executed: true,
      status: "completed",
      result,
      durationMs: Date.now() - startedAt,
      approvalRequired,
      requestId: request.context?.requestId,
      agentId: request.context?.agentId,
      userId: request.context?.userId,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Tool execution failed.";

    getDefaultAuditService().fire("tool_failed", {
      eventType: "tool_failed",
      requestId: request.context?.requestId,
      userId: request.context?.userId,
      organizationId: request.context?.organizationId,
      agentId: request.context?.agentId,
      toolId: tool.id,
      success: false,
      status: "error",
      metadata: { durationMs: Date.now() - startedAt },
    });
    console.error(
      `[tool-executor] ${tool.id} failed:`,
      error
    );
    return {
      success: false,
      toolId: tool.id,
      toolName: tool.name,
      executed: false,
      status: "failed",
      result: null,
      error: message,
      durationMs: Date.now() - startedAt,
      approvalRequired,
      requestId: request.context?.requestId,
      agentId: request.context?.agentId,
      userId: request.context?.userId,
    };
  }
}