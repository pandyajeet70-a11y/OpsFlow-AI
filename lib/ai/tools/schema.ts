/**
 * lib/ai/tools/schema.ts
 *
 * Dependency-free helpers for the typed tool-call contract:
 *
 *  - `buildToolCatalog`   : builds a serializable, model-friendly summary of the
 *                           registered tools (what the model is allowed to see).
 *  - `validateToolInput`  : validates raw arguments against a ToolInputSchema.
 *  - `extractToolJSON`    : robustly pulls a JSON object out of free-form model
 *                           text (handles code fences / prose around it).
 *
 * Nothing here touches the network, Firebase, or any provider — it is pure and
 * therefore easy to unit-test.
 */

import type {
  ToolDefinition,
  ToolInputSchema,
} from "./types";

/** A serializable, model-visible description of a tool. */
export interface ModelToolDescriptor {
  id: string;
  name: string;
  description: string;
  mutatesData?: boolean;
  requiresApproval: boolean;
  inputSchema?: ToolInputSchema;
}

/**
 * Produces the tool catalog the model is allowed to choose from.
 *
 * - Respects `visibleToModel: false` (invisible to the model).
 * - Respects `allowedAgents` so an agent can only ever be offered tools it is
 *   permitted to trigger (a hard, server-side guard — not just a prompt hint).
 */
export function buildToolCatalog(
  tools: ToolDefinition[],
  agentId?: string
): ModelToolDescriptor[] {
  return tools
    .filter((tool) => tool.visibleToModel !== false)
    .filter(
      (tool) =>
        !tool.allowedAgents ||
        !agentId ||
        tool.allowedAgents.includes(agentId)
    )
    .map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      mutatesData: tool.mutatesData,
      requiresApproval: tool.requiresApproval === true,
      inputSchema: tool.inputSchema,
    }));
}

export interface ToolInputValidation {
  valid: boolean;
  data: Record<string, unknown>;
  errors: string[];
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function typeMatches(schemaType: string, value: unknown): boolean {
  switch (schemaType) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return isPlainObject(value);
    default:
      return true;
  }
}

/**
 * Validates raw model/agent arguments against a tool's declared input schema.
 *
 * - missing required fields → error
 * - wrong primitive type → error
 * - extra fields are dropped (only declared fields are forwarded), which keeps
 *   arbitrary/unknown args from ever reaching the tool's business logic.
 */
export function validateToolInput(
  inputSchema: ToolInputSchema | undefined,
  input: Record<string, unknown> | undefined
): ToolInputValidation {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  if (input === undefined) {
    if (inputSchema && (inputSchema.required?.length ?? 0) > 0) {
      return {
        valid: false,
        data,
        errors: [`Missing required argument(s): ${inputSchema.required?.join(", ")}`],
      };
    }
    return { valid: true, data, errors };
  }

  if (!isPlainObject(input)) {
    return {
      valid: false,
      data,
      errors: ["Tool arguments must be an object."],
    };
  }

  if (!inputSchema) {
    // No contract declared — forward everything, but only if plain.
    return { valid: true, data: input, errors };
  }

  const required = inputSchema.required ?? [];

  for (const field of required) {
    if (input[field] === undefined || input[field] === null) {
      errors.push(`Missing required argument: ${field}`);
    }
  }

  for (const [field, prop] of Object.entries(inputSchema.properties ?? {})) {
    const value = input[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (!typeMatches(prop.type, value)) {
      errors.push(
        `Argument "${field}" must be a ${prop.type} (got ${typeof value}).`
      );
      continue;
    }
    data[field] =
      prop.type === "string" && typeof value === "string"
        ? value.trim()
        : value;
  }

  return { valid: errors.length === 0, data, errors };
}

/**
 * Extracts a JSON object from model output that may be wrapped in prose /
 * markdown code fences. Returns null if no object can be recovered.
 */
export function extractToolJSON(text: string): Record<string, unknown> | null {
  if (!text) return null;

  // Drop markdown code fences.
  const withoutFences = text
    .replace(/```[a-z]*\s*/gi, "")
    .replace(/```/g, "");

  // Prefer an explicit object literal.
  const start = withoutFences.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < withoutFences.length; i++) {
    const ch = withoutFences[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = withoutFences.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          return isPlainObject(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}