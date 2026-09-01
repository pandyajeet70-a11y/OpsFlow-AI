import { getTool, resolveToolId } from "../tools/registry";
import { validateToolInput } from "../tools/schema";

export interface WorkflowActionInput {
  toolId: string;
  input: Record<string, unknown>;
}

export interface WorkflowActionValidation {
  actions: WorkflowActionInput[];
  error?: string;
}

function actionParts(action: unknown): { rawId: string | null; input: Record<string, unknown> } {
  if (typeof action === "string") {
    return { rawId: action, input: {} };
  }

  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return { rawId: null, input: {} };
  }

  const candidate = action as Record<string, unknown>;
  const rawId =
    typeof candidate.toolId === "string"
      ? candidate.toolId
      : typeof candidate.id === "string"
        ? candidate.id
        : typeof candidate.name === "string"
          ? candidate.name
          : candidate.type === "webhook"
            ? "send_webhook"
            : null;
  const input = candidate.input;
  return {
    rawId,
    input: input && typeof input === "object" && !Array.isArray(input)
      ? input as Record<string, unknown>
      : candidate.type === "webhook"
        ? {
            url: candidate.url,
            payload: candidate.body ?? {},
          }
        : {},
  };
}

export function validateWorkflowActions(actions: unknown): WorkflowActionValidation {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { actions: [], error: "At least one workflow action is required." };
  }

  const normalized: WorkflowActionInput[] = [];
  for (const [index, action] of actions.entries()) {
    const { rawId, input } = actionParts(action);
    const toolId = rawId ? resolveToolId(rawId) : null;
    if (!toolId) {
      return {
        actions: [],
        error: `Action ${index + 1} is not a registered tool. Choose a registered tool ID or display name.`,
      };
    }

    const tool = getTool(toolId);
    if (!tool) {
      return { actions: [], error: `Action ${index + 1} could not be resolved to a registered tool.` };
    }

    const validation = validateToolInput(tool.inputSchema, input);
    if (!validation.valid) {
      return {
        actions: [],
        error: `Action ${index + 1} (${tool.name}) is missing or has invalid inputs: ${validation.errors.join(" ")} Add these values before saving or running the workflow.`,
      };
    }

    normalized.push({ toolId: tool.id, input: validation.data });
  }

  return { actions: normalized };
}