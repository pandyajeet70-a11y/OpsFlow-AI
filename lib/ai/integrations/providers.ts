import { lookup } from "node:dns/promises";
import nodemailer from "nodemailer";
import { adminDb } from "@/lib/firebase-admin";
import { getIntegrationConfig } from "./config";
import { resolveIntegrationMode } from "./resolution";
import type { CrmContact, CrmDeal, CrmProvider, EmailMessage, EmailProvider, IntegrationProvider } from "./types";

type ServerProviderConfig = {
  webhookSecret?: string;
  smtpHost?: string;
  smtpUser?: string;
  smtpPassword?: string;
  crmApiUrl?: string;
  crmApiKey?: string;
};

export function getServerProviderConfig(provider: IntegrationProvider): ServerProviderConfig {
  if (provider === "webhook") return { webhookSecret: process.env.WEBHOOK_SECRET };
  if (provider === "email") return { smtpHost: process.env.SMTP_HOST, smtpUser: process.env.SMTP_USER, smtpPassword: process.env.SMTP_PASSWORD };
  return { crmApiUrl: process.env.CRM_API_URL, crmApiKey: process.env.CRM_API_KEY };
}

export function isProviderConfigured(provider: IntegrationProvider): boolean {
  const config = getServerProviderConfig(provider);
  return provider === "webhook" ? Boolean(config.webhookSecret) : provider === "email" ? Boolean(config.smtpHost && config.smtpUser && config.smtpPassword) : Boolean(config.crmApiUrl && config.crmApiKey);
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized.includes(":")) return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  const octets = normalized.split(".").map(Number);
  return octets.length === 4 && (octets[0] === 10 || octets[0] === 127 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) || octets[0] === 169 && octets[1] === 254);
}

export async function postWebhook(urlValue: string, payload: Record<string, unknown>, organizationId: string, secret?: string) {
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new Error("Webhook URL is invalid."); }
  if (url.protocol !== "https:") throw new Error("Webhook URL must use HTTPS.");
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("Webhook URL is not allowed.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-webhook-secret": secret } : {}) }, body: JSON.stringify(payload), signal: controller.signal });
    return { provider: "webhook", status: response.ok ? "completed" as const : "failed" as const, httpStatus: response.status, organizationId };
  } catch (error) {
    console.error("[integration/webhook] request failed:", error instanceof Error ? error.name : "unknown");
    throw new Error("Webhook delivery failed.");
  } finally { clearTimeout(timeout); }
}

class ConfiguredEmailProvider implements EmailProvider {
  async send(message: EmailMessage, organizationId: string) {
    const config = getServerProviderConfig("email");
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) throw new Error("Email provider is not configured.");
    const transport = nodemailer.createTransport({ host: config.smtpHost, auth: { user: config.smtpUser, pass: config.smtpPassword } });
    await transport.sendMail({ from: message.from ?? config.smtpUser, to: message.to, subject: message.subject, text: message.text });
    const ref = await adminDb.collection("integrationDeliveries").add({ provider: "email", organizationId, to: message.to, subject: message.subject, status: "completed", createdAt: new Date().toISOString() });
    return { deliveryId: ref.id, provider: "email", status: "completed" as const };
  }
}

class ConfiguredCrmProvider implements CrmProvider {
  async createContact(contact: CrmContact, organizationId: string) {
    const config = getServerProviderConfig("crm");
    if (!config.crmApiUrl || !config.crmApiKey) throw new Error("CRM provider is not configured.");
    const response = await fetch(`${config.crmApiUrl.replace(/\/$/, "")}/contacts`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${config.crmApiKey}` }, body: JSON.stringify(contact) });
    if (!response.ok) throw new Error("CRM request failed.");
    const body = await response.json() as { id?: string };
    return { contactId: body.id ?? `crm_${Date.now()}`, provider: "crm" };
  }
  async updateContact(contactId: string, contact: Partial<CrmContact>, organizationId: string) { return this.createContact({ name: contact.name ?? contactId, email: contact.email ?? "unknown@example.com", ...contact }, organizationId).then((result) => ({ ...result, contactId })); }
  async createDeal(deal: CrmDeal, organizationId: string) { return { dealId: `crm_${Date.now()}`, provider: "crm" }; }
}

export async function resolveIntegrationProvider(organizationId: string, provider: IntegrationProvider) {
  const config = await getIntegrationConfig(organizationId, provider);
  const orgEnabled = config?.enabled === true;
  const configured = resolveIntegrationMode(orgEnabled, isProviderConfigured(provider)) === "configured";

  if (!orgEnabled) {
    return {
      config: null,
      configured: false,
      email: emailProvider,
      crm: crmProvider,
    };
  }

  return {
    config,
    configured,
    email: configured && provider === "email" ? new ConfiguredEmailProvider() : emailProvider,
    crm: configured && provider === "crm" ? new ConfiguredCrmProvider() : crmProvider,
  };
}

export class MockEmailProvider implements EmailProvider {
  async send(message: EmailMessage, organizationId: string) {
    const ref = await adminDb.collection("integrationDeliveries").add({ provider: "email", organizationId, to: message.to, subject: message.subject, status: "mocked", createdAt: new Date().toISOString() });
    return { deliveryId: ref.id, provider: "mock-email", status: "mocked" as const };
  }
}

export class MockCrmProvider implements CrmProvider {
  async createContact(contact: CrmContact, organizationId: string) {
    const ref = await adminDb.collection("integrationRecords").add({ provider: "crm", operation: "createContact", organizationId, contact, createdAt: new Date().toISOString() });
    return { contactId: ref.id, provider: "mock-crm" };
  }
  async updateContact(contactId: string, contact: Partial<CrmContact>, organizationId: string) {
    await adminDb.collection("integrationRecords").add({ provider: "crm", operation: "updateContact", organizationId, contactId, contact, createdAt: new Date().toISOString() });
    return { contactId, provider: "mock-crm" };
  }
  async createDeal(deal: CrmDeal, organizationId: string) {
    const ref = await adminDb.collection("integrationRecords").add({ provider: "crm", operation: "createDeal", organizationId, deal, createdAt: new Date().toISOString() });
    return { dealId: ref.id, provider: "mock-crm" };
  }
}

export const emailProvider: EmailProvider = new MockEmailProvider();
export const crmProvider: CrmProvider = new MockCrmProvider();
