import { adminDb } from "@/lib/firebase-admin";
import { registerTool } from "../registry";
import { emailProvider, postWebhook, resolveIntegrationProvider, getServerProviderConfig } from "@/lib/ai/integrations/providers";

function organizationId(context: { organizationId?: string } | undefined): string {
  if (!context?.organizationId) throw new Error("Organization context is required.");
  return context.organizationId;
}

registerTool({
  id: "send_webhook",
  name: "Send Webhook",
  description: "POSTs a JSON payload to an approved HTTPS webhook.",
  mutatesData: true,
  requiresApproval: true,
  inputSchema: { type: "object", properties: { url: { type: "string" }, payload: { type: "object" } }, required: ["url", "payload"] },
  async execute(input, context) {
    const orgId = organizationId(context);
    const resolved = await resolveIntegrationProvider(orgId, "webhook");
    const endpoint = resolved.config?.enabled && typeof resolved.config.metadata.endpoint === "string" ? resolved.config.metadata.endpoint : String(input.url);
    const result = await postWebhook(endpoint, input.payload as Record<string, unknown>, orgId, resolved.configured ? getServerProviderConfig("webhook").webhookSecret : undefined);
    return { provider: result.provider, status: result.status, httpStatus: result.httpStatus };
  },
});

registerTool({
  id: "send_email",
  name: "Send Email",
  description: "Sends an email through the configured email provider.",
  mutatesData: true,
  requiresApproval: true,
  inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, text: { type: "string" }, from: { type: "string" } }, required: ["to", "subject", "text"] },
  async execute(input, context) {
    const orgId = organizationId(context);
    if (!String(input.to).includes("@")) throw new Error("Email recipient is invalid.");
    const resolved = await resolveIntegrationProvider(orgId, "email");
    return resolved.email.send({ to: String(input.to), subject: String(input.subject), text: String(input.text), ...(input.from ? { from: String(input.from) } : {}) }, orgId);
  },
});

registerTool({
  id: "crm_create_contact",
  name: "CRM Create Contact",
  description: "Creates a contact through the configured CRM provider.",
  mutatesData: true,
  requiresApproval: true,
  inputSchema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, company: { type: "string" } }, required: ["name", "email"] },
  async execute(input, context) {
    const orgId = organizationId(context);
    if (!String(input.email).includes("@")) throw new Error("CRM contact email is invalid.");
    const resolved = await resolveIntegrationProvider(orgId, "crm");
    return resolved.crm.createContact({ name: String(input.name), email: String(input.email), ...(input.company ? { company: String(input.company) } : {}) }, orgId);
  },
});

export async function getIntegrationRecord(id: string) {
  const document = await adminDb.collection("integrationRecords").doc(id).get();
  return document.exists ? document.data() : null;
}
