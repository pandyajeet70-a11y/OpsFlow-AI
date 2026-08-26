import { canManageIntegration, canViewIntegration } from "../lib/ai/auth/authorization";
import { InMemoryApprovalStore, type ApprovalStore } from "../lib/ai/approvals/store";
import { approveApproval, createApproval, type ApprovalServiceDeps } from "../lib/ai/approvals/service";
import { registerTool, getTool } from "../lib/ai/tools/registry";
import type { ToolExecutionResult } from "../lib/ai/tools/types";
import { resolveIntegrationMode } from "../lib/ai/integrations/resolution";

let failures = 0;
function check(name: string, condition: boolean): void { if (condition) console.log(`PASS ${name}`); else { failures++; console.log(`FAIL ${name}`); } }

const persistedDeliveries: string[] = [];
registerTool({ id: "integration_fixture", name: "Integration Fixture", description: "Approval-gated integration fixture", mutatesData: true, requiresApproval: true, inputSchema: { type: "object", properties: { mode: { type: "string" } }, required: ["mode"] }, execute: async (input) => { const delivery = `delivery_${persistedDeliveries.length + 1}`; persistedDeliveries.push(delivery); return { deliveryId: delivery, provider: input.mode }; } });

function execute(): ApprovalServiceDeps["execute"] {
  return async ({ toolId, input, context }): Promise<ToolExecutionResult> => {
    const tool = getTool(toolId);
    if (!tool || (tool.requiresApproval && context?.approved !== true)) return { success: false, toolId, toolName: tool?.name ?? toolId, executed: false, status: "requires_approval", result: null, durationMs: 0, approvalRequired: true, error: "Approval required." };
    const result = await tool.execute(input, context);
    return { success: true, toolId, toolName: tool.name, executed: true, status: "completed", result, durationMs: 0, approvalRequired: true };
  };
}

function deps(store: ApprovalStore): ApprovalServiceDeps { return { store, resolveTool: getTool, execute: execute() }; }

async function main(): Promise<void> {
  check("owner can manage integrations", canManageIntegration("owner"));
  check("operator-style viewer can read integrations", canViewIntegration("viewer"));
  check("disabled or missing credentials select mock", resolveIntegrationMode(false, true) === "mock" && resolveIntegrationMode(true, false) === "mock");
  check("enabled connection with credentials selects configured", resolveIntegrationMode(true, true) === "configured");
  const store = new InMemoryApprovalStore();
  const approval = await createApproval(deps(store), { requestId: "integration_req", userId: "owner_1", organizationId: "org_1", toolId: "integration_fixture", toolName: "Integration Fixture", arguments: { mode: "mock" } });
  check("integration execution is approval-gated", approval.status === "pending" && persistedDeliveries.length === 0);
  const result = await approveApproval(deps(store), { approvalId: approval.approvalId, callerUserId: "owner_1", callerOrganizationId: "org_1", callerOrgRole: "owner" });
  check("approved integration persists delivery and audit", result.ok && result.approval?.status === "executed" && persistedDeliveries.length === 1 && result.approval.audit.some((entry) => entry.event === "tool_executed"));
  if (failures) process.exitCode = 1;
}

void main();