/**
 * scripts/approval-tests.ts
 *
 * Offline tests for the persisted approval workflow.
 *
 * Uses the dependency-injected ApprovalService with:
 *  - InMemoryApprovalStore (atomic, mutex-serialized transitions)
 *  - the real tool registry (create_campaign / failing_tool fixtures)
 *  - a stub `execute` that mirrors the executor's approval gate
 *
 * Covers: creation, approve→execute, rejection, expiration, unauthorized
 * approval, double-execution prevention, failed tool execution, not-found.
 *
 * Compile with tsconfig.smoke.json and run:
 *   node scripts-dist/scripts/approval-tests.js
 */

import {
  InMemoryApprovalStore,
  type ApprovalStore,
} from "../lib/ai/approvals/store";
import {
  approveApproval,
  createApproval,
  rejectApproval,
  type ApprovalServiceDeps,
} from "../lib/ai/approvals/service";
import { getTool, registerTool } from "../lib/ai/tools/registry";
import type { ToolExecutionResult } from "../lib/ai/tools/types";

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

/* ---------------------------------------------------------------
   Fixtures (registered into the shared alias-free registry)
   --------------------------------------------------------------- */

let campaignExecutions = 0;

registerTool({
  id: "create_campaign",
  name: "Create Campaign",
  description: "Creates a campaign.",
  mutatesData: true,
  requiresApproval: true,
  inputSchema: {
    type: "object",
    properties: { name: { type: "string" }, budget: { type: "number" } },
    required: ["name"],
  },
  execute: async (input) => {
    campaignExecutions++;
    return { id: "C1", name: input.name, budget: input.budget ?? null };
  },
});

registerTool({
  id: "failing_tool",
  name: "Failing Tool",
  description: "Always throws.",
  mutatesData: true,
  requiresApproval: true,
  inputSchema: { type: "object", properties: {} },
  execute: async () => {
    throw new Error("boom");
  },
});

/**
 * Mirrors the executor contract: approval-required tools only run when
 * `context.approved === true`, throws are captured into failed results.
 */
function makeExecute(): ApprovalServiceDeps["execute"] {
  return async ({ toolId, input, context }): Promise<ToolExecutionResult> => {
    const tool = getTool(toolId);
    const startedAt = Date.now();
    if (!tool) {
      return {
        success: false,
        toolId,
        toolName: toolId,
        executed: false,
        status: "failed",
        result: null,
        durationMs: 0,
        approvalRequired: false,
        error: `Tool "${toolId}" is not registered.`,
      };
    }
    const approvalRequired = tool.requiresApproval === true;
    if (approvalRequired && context?.approved !== true) {
      return {
        success: false,
        toolId,
        toolName: tool.name,
        executed: false,
        status: "requires_approval",
        result: null,
        durationMs: 0,
        approvalRequired: true,
        error: `Tool "${tool.id}" requires approval before execution.`,
      };
    }
    try {
      const result = await tool.execute(input, context);
      return {
        success: true,
        toolId,
        toolName: tool.name,
        executed: true,
        status: "completed",
        result,
        durationMs: Date.now() - startedAt,
        approvalRequired,
      };
    } catch (e) {
      return {
        success: false,
        toolId,
        toolName: tool.name,
        executed: false,
        status: "failed",
        result: null,
        durationMs: Date.now() - startedAt,
        approvalRequired,
        error: e instanceof Error ? e.message : "Tool execution failed.",
      };
    }
  };
}

function makeDeps(store: ApprovalStore): ApprovalServiceDeps {
  return { store, resolveTool: getTool, execute: makeExecute() };
}

async function main(): Promise<void> {
  /* -----------------------------------------------
     1. Approval creation
     ----------------------------------------------- */
  console.log("== Approval creation ==");
  const store1 = new InMemoryApprovalStore();
  const created = await createApproval(makeDeps(store1), {
    requestId: "req_1",
    userId: "alice",
    agentId: "operations",
    toolId: "create_campaign",
    toolName: "Create Campaign",
    arguments: { name: "Acme Corp.", channel: "" },
  });
  check(
    "returns pending approval with id + stored args",
    created.status === "pending" &&
      Boolean(created.approvalId) &&
      created.toolId === "create_campaign" &&
      (created.arguments as { name?: unknown }).name === "Acme Corp.",
    JSON.stringify(created)
  );
  check(
    "audit contains approval_created",
    created.audit.some((a) => a.event === "approval_created"),
    JSON.stringify(created.audit)
  );

  /* -----------------------------------------------
     2. Approve → executed (successful)
     ----------------------------------------------- */
  console.log("\n== Approve → executed ==");
  const res = await approveApproval(makeDeps(store1), {
    approvalId: created.approvalId,
    callerUserId: "alice",
  });
  check(
    "approval executes successfully",
    res.ok &&
      res.code === "approved" &&
      res.approval?.status === "executed" &&
      res.execution?.success === true,
    JSON.stringify(res)
  );
  check(
    "result persisted + executedAt set + tool_executed audit",
    res.approval?.executionResult != null &&
      Boolean(res.approval?.executedAt) &&
      Boolean(res.approval?.audit.some((a) => a.event === "tool_executed")),
    JSON.stringify(res.approval?.audit)
  );
  check(
    "executed stored server-side args",
    (res.execution?.result as { name?: unknown } | undefined)?.name === "Acme Corp."
  );

  /* -----------------------------------------------
     5. Unauthorized approval
     ----------------------------------------------- */
  console.log("\n== Unauthorized approval ==");
  const store2 = new InMemoryApprovalStore();
  const owned = await createApproval(makeDeps(store2), {
    requestId: "req_2",
    userId: "alice",
    agentId: "operations",
    toolId: "create_campaign",
    toolName: "Create Campaign",
    arguments: { name: "X" },
  });
  const unauth = await approveApproval(makeDeps(store2), {
    approvalId: owned.approvalId,
    callerUserId: "mallory",
  });
  check(
    "unauthorized caller rejected",
    !unauth.ok && unauth.code === "unauthorized",
    JSON.stringify(unauth)
  );
  check(
    "approval stays pending after unauthorized attempt",
    (await store2.get(owned.approvalId))?.status === "pending"
  );

  /* -----------------------------------------------
     4. Expiration
     ----------------------------------------------- */
  console.log("\n== Expiration ==");
  const store3 = new InMemoryApprovalStore();
  const exp = await createApproval(makeDeps(store3), {
    requestId: "req_3",
    toolId: "create_campaign",
    toolName: "Create Campaign",
    arguments: { name: "E" },
    expiresInMs: -5_000,
  });
  const expRes = await approveApproval(makeDeps(store3), {
    approvalId: exp.approvalId,
  });
  check(
    "expired approval cannot be approved",
    !expRes.ok && expRes.code === "expired" && expRes.approval?.status === "expired",
    JSON.stringify(expRes)
  );

  /* -----------------------------------------------
     6. Double execution prevention
     ----------------------------------------------- */
  console.log("\n== Double execution prevention ==");
  campaignExecutions = 0;
  const store4 = new InMemoryApprovalStore();
  const dbl = await createApproval(makeDeps(store4), {
    requestId: "req_4",
    toolId: "create_campaign",
    toolName: "Create Campaign",
    arguments: { name: "D" },
  });
  const [r1, r2] = await Promise.all([
    approveApproval(makeDeps(store4), { approvalId: dbl.approvalId }),
    approveApproval(makeDeps(store4), { approvalId: dbl.approvalId }),
  ]);
  const okCount = [r1, r2].filter((r) => r.ok).length;
  const alreadyCount = [r1, r2].filter((r) => r.code === "already_processed").length;
  check(
    "concurrent double approval prevented (exactly one ok)",
    okCount === 1 && alreadyCount === 1,
    JSON.stringify([r1, r2].map((r) => r.code))
  );
  check("tool executed exactly once", campaignExecutions === 1);
  check(
    "final status executed",
    (await store4.get(dbl.approvalId))?.status === "executed"
  );

  /* -----------------------------------------------
     3. Rejection never executes
     ----------------------------------------------- */
  console.log("\n== Rejection ==");
  campaignExecutions = 0;
  const store5 = new InMemoryApprovalStore();
  const rej = await createApproval(makeDeps(store5), {
    requestId: "req_5",
    toolId: "create_campaign",
    toolName: "Create Campaign",
    arguments: { name: "R" },
  });
  const rejRes = await rejectApproval(makeDeps(store5), {
    approvalId: rej.approvalId,
  });
  check(
    "rejection succeeds",
    rejRes.ok && rejRes.code === "rejected" && rejRes.approval?.status === "rejected",
    JSON.stringify(rejRes)
  );
  check(
    "rejection adds approval_rejected audit",
    Boolean(rejRes.approval?.audit.some((a) => a.event === "approval_rejected"))
  );
  const afterReject = await approveApproval(makeDeps(store5), {
    approvalId: rej.approvalId,
  });
  check(
    "rejected approval cannot be approved",
    !afterReject.ok && afterReject.code === "already_processed",
    JSON.stringify(afterReject)
  );
  check("rejected approval never executes", campaignExecutions === 0);

  /* -----------------------------------------------
     7. Failed tool execution
     ----------------------------------------------- */
  console.log("\n== Failed tool execution ==");
  const store6 = new InMemoryApprovalStore();
  const fail = await createApproval(makeDeps(store6), {
    requestId: "req_6",
    toolId: "failing_tool",
    toolName: "Failing Tool",
    arguments: {},
  });
  const failRes = await approveApproval(makeDeps(store6), {
    approvalId: fail.approvalId,
  });
  check(
    "failed execution marks approval failed",
    !failRes.ok &&
      failRes.code === "execution_failed" &&
      failRes.approval?.status === "failed",
    JSON.stringify(failRes)
  );
  check(
    "failed execution adds tool_failed audit + error",
    Boolean(failRes.approval?.audit.some((a) => a.event === "tool_failed")) &&
      failRes.approval?.executionError === "boom",
    JSON.stringify(failRes.approval?.executionError)
  );

  /* -----------------------------------------------
     8. Not found
     ----------------------------------------------- */
  console.log("\n== Not found ==");
  const nf = await approveApproval(makeDeps(new InMemoryApprovalStore()), {
    approvalId: "appr_test_999999",
  });
  check("unknown approval is not found", !nf.ok && nf.code === "not_found");

  console.log(
    failures === 0 ? "\nALL APPROVAL TESTS PASSED" : `\n${failures} FAILURE(S)`
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();