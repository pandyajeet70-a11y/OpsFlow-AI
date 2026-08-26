export type IntegrationProvider = "webhook" | "email" | "crm";
export type IntegrationActionType = "send_webhook" | "send_email" | "crm_create_contact";
export type IntegrationStatus = "completed" | "failed" | "pending";
export type IntegrationConnectionStatus = "enabled" | "disabled";

export interface IntegrationConnection {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationConnectionStatus;
  createdAt?: string;
  updatedAt?: string;
  lastTestedAt?: string;
  metadata: Record<string, unknown>;
  configured?: boolean;
}

export interface IntegrationAction<TInput = Record<string, unknown>, TResult = Record<string, unknown>> {
  provider: IntegrationProvider;
  actionType: IntegrationActionType;
  input: TInput;
  organizationId: string;
  result?: TResult;
  status: IntegrationStatus;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  from?: string;
}

export interface EmailProvider {
  send(message: EmailMessage, organizationId: string): Promise<{ deliveryId: string; provider: string; status: "mocked" | "completed" }>;
}

export interface CrmContact {
  name: string;
  email: string;
  company?: string;
}

export interface CrmDeal {
  name: string;
  value?: number;
  contactId?: string;
}

export interface CrmProvider {
  createContact(contact: CrmContact, organizationId: string): Promise<{ contactId: string; provider: string }>;
  updateContact(contactId: string, contact: Partial<CrmContact>, organizationId: string): Promise<{ contactId: string; provider: string }>;
  createDeal(deal: CrmDeal, organizationId: string): Promise<{ dealId: string; provider: string }>;
}
