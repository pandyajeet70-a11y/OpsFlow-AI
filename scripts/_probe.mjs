/* Probe: ask Ollama directly exactly like decideToolCallWithModel does. */
const SYSTEM = `You are the OpsFlow tool router.
Your only job is to decide whether the user's request maps to exactly one
registered OpsFlow tool, and if so, to return a JSON object describing that call.

Rules:
- Only ever choose a tool from the provided catalog. Never invent one.
- If the request is a normal conversational/text request with no tool intent,
  return {"tool": null}.
- If the request clearly maps to a tool but important required arguments are
  missing from the user's message, still return the tool with the arguments you
  can extract, leaving missing ones absent so validation can report them.
- For multi-step or ambiguous requests, prefer {"tool": null}.

Respond with ONLY a single JSON object, no prose, no markdown:

For a tool call:
{"tool":{"id":"<tool id>","arguments":{...}}}

For no tool:
{"tool":null}`;

const catalog = [
  {
    id: "create_lead",
    name: "Create Lead",
    description: "Creates a new business lead and permanently saves it to OpsFlow Firestore.",
    requiresApproval: false,
    mutatesData: true,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name of the lead." },
        email: { type: "string", description: "Lead contact email address." },
        company: { type: "string", description: "Lead company or organization." },
        source: { type: "string", description: "Where the lead originated." },
      },
      required: ["name", "email", "company"],
    },
  },
  {
    id: "create_campaign",
    name: "Create Campaign",
    description: "Creates a new marketing campaign with a budget and target channel. Requires explicit approval before it can execute.",
    requiresApproval: true,
    mutatesData: true,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Campaign name." },
        budget: { type: "number", description: "Campaign budget in dollars (positive number)." },
        channel: { type: "string", description: "Target channel (email, social, ads, etc.)." },
      },
      required: ["name", "budget"],
    },
  },
];

const prompt = "Create a campaign for Acme Corp.";

const userPrompt = `Available tools (JSON):\n${JSON.stringify(catalog, null, 2)}\n\nUser request:\n"""\n${prompt}\n"""\n\nReturn the tool decision JSON now.`;

const body = {
  model: "llama3.1",
  prompt: userPrompt,
  system: SYSTEM,
  stream: false,
  options: { temperature: 0, num_predict: 500 },
};

fetch("http://localhost:11434/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
  .then((r) => r.json())
  .then((d) => {
    console.log("=== RAW MODEL OUTPUT ===");
    console.log(d.response);
  })
  .catch((e) => {
    console.error("ERROR", e.message);
    process.exit(1);
  });