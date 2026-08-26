import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { IntegrationConnection, IntegrationProvider } from "./types";

export interface IntegrationConfig {
  id?: string;
  organizationId?: string;
  provider: IntegrationProvider;
  name?: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  status?: "enabled" | "disabled";
  createdAt?: unknown;
  updatedAt?: unknown;
  lastTestedAt?: unknown;
}

export async function listIntegrationConfigs(organizationId: string): Promise<IntegrationConfig[]> {
  const snapshot = await adminDb.collection("organizations").doc(organizationId).collection("integrations").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, organizationId, ...doc.data() } as IntegrationConfig));
}

export async function getIntegrationConfig(organizationId: string, id: string): Promise<IntegrationConfig | null> {
  const doc = await adminDb.collection("organizations").doc(organizationId).collection("integrations").doc(id).get();
  return doc.exists ? ({ id: doc.id, organizationId, ...doc.data() } as IntegrationConfig) : null;
}

export async function saveIntegrationConfig(organizationId: string, config: IntegrationConfig, id = config.id ?? config.provider): Promise<string> {
  const ref = adminDb.collection("organizations").doc(organizationId).collection("integrations").doc(id);
  await ref.set({
    name: config.name ?? config.provider,
    provider: config.provider,
    enabled: config.enabled,
    status: config.enabled ? "enabled" : "disabled",
    metadata: config.metadata,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: config.createdAt ?? FieldValue.serverTimestamp(),
  }, { merge: true });
  return ref.id;
}

export async function updateIntegrationTestedAt(organizationId: string, id: string): Promise<void> {
  await adminDb.collection("organizations").doc(organizationId).collection("integrations").doc(id).update({ lastTestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}

export function toPublicIntegration(organizationId: string, config: IntegrationConfig): IntegrationConnection {
  return {
    id: config.id ?? config.provider,
    organizationId,
    provider: config.provider,
    name: config.name ?? config.provider,
    status: config.enabled ? "enabled" : "disabled",
    metadata: config.metadata ?? {},
    ...(config.createdAt ? { createdAt: timestampToString(config.createdAt) } : {}),
    ...(config.updatedAt ? { updatedAt: timestampToString(config.updatedAt) } : {}),
    ...(config.lastTestedAt ? { lastTestedAt: timestampToString(config.lastTestedAt) } : {}),
  };
}

function timestampToString(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  return String(value);
}
