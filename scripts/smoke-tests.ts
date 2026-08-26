/**
 * scripts/smoke-tests.ts
 *
 * Lightweight, offline smoke tests for the OpsFlow typed tool-call contract.
 *
 * These exercise the **alias-free, provider-agnostic** modules only:
 *   - lib/ai/tools/schema.ts    (validation, catalog, JSON extraction)
 *   - lib/ai/tools/decision.ts  (model-driven decision, unregistered guard)
 *   - lib/ai/tools/registry.ts  (registration)
 *
 * The executor + builtins path is validated by `npx tsc --noEmit` and
 * `next build` (they require Firebase Admin + Firestore at runtime, which
 * this offline harness cannot provide).
 *
 * Compile with tsconfig.smoke.json and run: node scripts-dist/scripts/smoke-tests.js
 */

import {
  registerTool,
  listTools,
  getTool,
} from "../lib/ai/tools/registry";
import {
  buildToolCatalog,
  extractToolJSON,
  validateToolInput,
} from "../lib/ai/tools/schema";
import {
  decideToolCallWithModel,
  normalizeModelDecision,
} from "../lib/ai/tools/decision";
import type { AIProvider } from "../lib/ai/types";

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
   Fixtures
   --------------------------------------------------------------- */

registerTool({
  id: "create_lead",
  name: "Create Lead",
  description: "Creates a lead.",
  mutatesData: true,
  requiresApproval: false,
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      company: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "email", "company"],
  },
  execute: async (input) => ({ id: "L1", ...input }),
});

registerTool({
  id: "create_campaign",
  name: "Create Campaign",
  description: "Creates a campaign.",
  mutatesData: true,
  requiresApproval: true,
  inputSchema: {
    type: "object",
    properties: { name: { type: "string" }, budget: { type: "number" } },
    required: ["name", "budget"],
  },
  execute: async (input) => ({ id: "C1", ...input }),
});

registerTool({
  id: "admin_tool",
  name: "Admin Tool",
  description: "Operations-only.",
  mutatesData: true,
  requiresApproval: true,
  allowedAgents: ["operations"],
  inputSchema: { type: "object", properties: {} },
  execute: async () => ({ ok: true }),
});

const leadSchema = getTool("create_lead")?.inputSchema;

console.log("== Input schema validation (typed tool-call contract) ==");
check(
  "good args pass; extra dropped; wrong-typed dropped",
  (() => {
    const v = validateToolInput(leadSchema, {
      name: "Jane",
      email: "j@x.com",
      company: "Acme",
      extra: "ignored",
      age: "not-a-number",
    });
    return !v.valid && !("extra" in v.data) && !("age" in v.data);
  })()
);
check(
  "missing required rejected",
  (() => {
    const v = validateToolInput(leadSchema, { name: "Jane", email: "j@x.com" });
    return !v.valid && v.errors.some((e) => e.includes("company"));
  })()
);
check(
  "complete args valid",
  validateToolInput(leadSchema, {
    name: "Jane",
    email: "j@x.com",
    company: "Acme",
  }).valid
);

console.log("\n== JSON extraction from free-form model text ==");
const j1 = extractToolJSON(
  'Sure! Here you go:\n```json\n{"tool":{"id":"create_lead","arguments":{"name":"Jane"}}}\n```'
);
check(
  "extracts object from code fence",
  (j1?.tool as { id?: string } | undefined)?.id === "create_lead",
  JSON.stringify(j1)
);
check("returns null for non-JSON", extractToolJSON("I don't know.") === null);

console.log("\n== Unregistered tools never pass the decision gate (F) ==");
const d1 = normalizeModelDecision({ tool: { id: "i_am_not_real", arguments: {} } });
check(
  "unregistered tool blocked",
  d1.type === "none" && String(d1.reason).startsWith("unregistered_tool"),
  JSON.stringify(d1)
);

console.log("\n== Approval requirement recomputed from registry (G) ==");
const d2 = normalizeModelDecision({
  tool: { id: "create_campaign", arguments: { name: "Q4", budget: 5000 } },
});
check(
  "approval flag recomputed, not trusted from model",
  d2.type === "tool" && d2.approvalRequired === true,
  JSON.stringify(d2)
);
const d2b = normalizeModelDecision({
  tool: {
    id: "create_lead",
    arguments: { name: "Jane", email: "j@x.com", company: "Acme" },
  },
});
check(
  "non-approval tool stays false",
  d2b.type === "tool" && d2b.approvalRequired === false,
  JSON.stringify(d2b)
);

console.log("\n== Model-driven decisions (A) ==");
async function runModelDecisionTests(): Promise<void> {
  const providerLead: AIProvider = {
    name: "ollama",
    generate: async () => ({
      text: '{"tool":{"id":"create_lead","arguments":{"name":"Ada","email":"ada@x.com","company":"X"}}}',
      provider: "ollama",
      model: "mock",
    }),
  };
  const d3 = await decideToolCallWithModel({
    prompt: "add lead Ada at company X",
    agentId: "sales",
    provider: providerLead,
  });
  check(
    "model choosing create_lead returns typed tool decision",
    d3.type === "tool" && d3.toolId === "create_lead",
    JSON.stringify(d3)
  );

  const providerCampaign: AIProvider = {
    name: "ollama",
    generate: async () => ({
      text: '{"tool":{"id":"create_campaign","arguments":{"name":"Blast","budget":1000}}}',
      provider: "ollama",
      model: "mock",
    }),
  };
  const d4 = await decideToolCallWithModel({
    prompt: "create a campaign called Blast",
    agentId: "sales",
    provider: providerCampaign,
  });
  check(
    "model choosing approval tool surfaces approvalRequired",
    d4.type === "tool" && d4.approvalRequired === true,
    JSON.stringify(d4)
  );

  /*
   * Regression: "Create a campaign for Acme Corp." — the model returns the
   * create_campaign tool with a name but without a budget (a required field).
   * Because create_campaign requires approval, the decision must still surface
   * as a tool decision (approvalRequired true) so the request reaches the
   * executor's approval gate and returns `requires_approval` — instead of being
   * dropped and falling back to a plain-text reply.
   */
  const providerAcme: AIProvider = {
    name: "ollama",
    generate: async () => ({
      text: '{"tool":{"id":"create_campaign","arguments":{"name":"Acme Corp.","channel":""}}}',
      provider: "ollama",
      model: "mock",
    }),
  };
  const d4b = await decideToolCallWithModel({
    prompt: "Create a campaign for Acme Corp.",
    agentId: "operations",
    provider: providerAcme,
  });
  check(
    "approval-required tool with incomplete args still returns a tool decision (requires_approval path)",
    d4b.type === "tool" &&
      d4b.toolId === "create_campaign" &&
      d4b.approvalRequired === true,
    JSON.stringify(d4b)
  );

  /*
   * Sanity: a NON-approval tool (create_lead) with incomplete required args must
   * NOT surface as an executable tool decision — it must stay rejected so bad
   * data never runs. This preserves create_lead behavior.
   */
  const providerLeadIncomplete: AIProvider = {
    name: "ollama",
    generate: async () => ({
      text: '{"tool":{"id":"create_lead","arguments":{"name":"Ada"}}}',
      provider: "ollama",
      model: "mock",
    }),
  };
  const d3b = await decideToolCallWithModel({
    prompt: "add lead Ada",
    agentId: "sales",
    provider: providerLeadIncomplete,
  });
  check(
    "non-approval tool with incomplete args stays rejected (create_lead preserved)",
    d3b.type === "none" &&
      String(d3b.reason).startsWith("invalid_arguments"),
    JSON.stringify(d3b)
  );

  const providerNone: AIProvider = {
    name: "ollama",
    generate: async () => ({ text: '{"tool":null}', provider: "ollama", model: "mock" }),
  };
  const d5 = await decideToolCallWithModel({
    prompt: "hello, how does our pricing work?",
    agentId: "sales",
    provider: providerNone,
  });
  check("no-tool intent stays text-only", d5.type === "none", JSON.stringify(d5));

  const providerGarbage: AIProvider = {
    name: "ollama",
    generate: async () => ({
      text: "I don't know what tool to use.",
      provider: "ollama",
      model: "mock",
    }),
  };
  const d6 = await decideToolCallWithModel({
    prompt: "hello",
    agentId: "sales",
    provider: providerGarbage,
  });
  check(
    "unreadable model response degrades to no-tool",
    d6.type === "none",
    JSON.stringify(d6)
  );

  console.log(
    failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURE(S)`
  );
  process.exit(failures === 0 ? 0 : 1);
}
void runModelDecisionTests();

