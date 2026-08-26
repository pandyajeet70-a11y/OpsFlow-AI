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