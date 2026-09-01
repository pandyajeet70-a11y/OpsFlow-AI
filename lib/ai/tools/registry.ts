/**
 * lib/ai/tools/registry.ts
 *
 * Central registry for all OpsFlow tools.
 *
 * Agents do not import tools directly.
 * They resolve tools through this registry.
 */

import type { ToolDefinition } from "./types";

/* =========================================================
   Registry
   ========================================================= */

const tools = new Map<string, ToolDefinition>();

const toolAliases: Record<string, string> = {
  "create customer profile": "create_lead",
  "create profile": "create_lead",
  "customer profile": "create_lead",
  "prepare sales handoff": "create_customer_handoff",
  "prepare customer handoff": "create_customer_handoff",
  "create customer handoff": "create_customer_handoff",
  "sales handoff": "create_customer_handoff",
  "send welcome email": "send_email",
  "send email": "send_email",
  "welcome email": "send_email",
  "notify team": "send_email",
  "assign owner": "create_customer_handoff",
  "sync customer record": "crm_create_contact",
  "create campaign": "create_campaign",
  "create lead": "create_lead",
};

function normalizeToolToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   Register
   ========================================================= */

export function registerTool(tool: ToolDefinition): void {
  if (!tool.id || !tool.id.trim()) {
    throw new Error("Tool id is required.");
  }

  if (tools.has(tool.id)) {
    throw new Error(
      `Tool "${tool.id}" is already registered.`
    );
  }

  tools.set(tool.id, tool);
}

/* =========================================================
   Get
   ========================================================= */

export function getTool(
  toolId: string
): ToolDefinition | undefined {
  return tools.get(toolId);
}

export function resolveToolId(rawToolId: string | null | undefined): string | null {
  if (typeof rawToolId !== "string") {
    return null;
  }

  const trimmed = rawToolId.trim();
  if (!trimmed) {
    return null;
  }

  if (tools.has(trimmed)) {
    return trimmed;
  }

  const normalized = normalizeToolToken(trimmed);
  if (!normalized) {
    return null;
  }

  const alias = toolAliases[normalized];
  if (alias && tools.has(alias)) {
    return alias;
  }

  for (const tool of tools.values()) {
    const toolName = normalizeToolToken(tool.name);
    const toolKey = normalizeToolToken(tool.id);
    if (toolName === normalized || toolKey === normalized) {
      return tool.id;
    }
  }

  return alias ?? null;
}

/* =========================================================
   List
   ========================================================= */

export function listTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

/* =========================================================
   Has
   ========================================================= */

export function hasTool(toolId: string): boolean {
  return tools.has(toolId);
}

/* =========================================================
   Remove
   ========================================================= */

export function unregisterTool(toolId: string): boolean {
  return tools.delete(toolId);
}