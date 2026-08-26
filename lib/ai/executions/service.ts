/**
 * lib/ai/executions/service.ts
 *
 * Core execution service (Phase 5 – durable execution engine).
 *
 * Coordinates execution creation, step execution, retries, approvals,
 * timeouts, and audit integration while preserving tenant isolation and
 * security guarantees.
 *
 * SECURITY / PRIVACY:
 *  - Never stores raw prompts, secrets, tokens, authorization headers.
 *  - Never exposes client-supplied organizationId / userId.
 *  - Audit failures NEVER break execution.
 */

import type {
  Execution,
  CreationInput,
  ExecutionStep,
  DefaultToolRetryPolicy,
  ExecuteStepResponse,
  ExecutionStore,
} from "./types";
import type { ApprovalServiceDeps } from "../approvals";
import type { AuditService } from "../audit";
import type { ToolDefinition } from "../tools/types";
import type { ToolExecutionContext } from "../tools/types";

interface ExecutionServiceDeps {
  store: ExecutionStore;
  approvalService: ApprovalServiceDeps;
  audit: AuditService;
  resolveTool: (toolId: string) => ToolDefinition | undefined;
  executeTool: (
    toolId: string,
    input: Record<string, unknown>,
    context?: ToolExecutionContext
  ) => Promise<unknown>;
}

class ExecutionService {
  constructor(private deps: ExecutionServiceDeps) {}

  async createExecution(input: CreationInput): Promise<Execution> {
    // Idempotency check by requestId
    const existing = await this.deps.store.getExecutionByRequestId(input.requestId);
    if (existing) {
      return existing;
    }

    return this.deps.store.createExecution(input);
  }
}
