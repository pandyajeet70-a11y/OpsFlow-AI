/**
 * lib/ai/tools/builtins/customer-handoff-tools.ts
 *
 * Built-in Sales-to-Customer-Success handoff tooling for OpsFlow.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { registerTool } from "../registry";
import type { CustomerHandoff, OnboardingPlan } from "@/lib/ai/onboarding/types";
import { emitWorkflowEvent } from "@/lib/ai/events/dispatcher";

registerTool({
  id: "create_customer_handoff",
  name: "Create Customer Handoff",
  description:
    "Creates a structured Sales-to-Customer-Success handoff and saves it to Firestore.",
  mutatesData: true,
  requiresApproval: false,
  inputSchema: {
    type: "object",
    properties: {
      customerName: { type: "string", description: "Customer name." },
      customerEmail: { type: "string", description: "Customer email address." },
      company: { type: "string", description: "Customer company." },
      dealSummary: { type: "string", description: "Summary of the closed or qualified deal." },
      salesNotes: { type: "string", description: "Notes from Sales for Customer Success." },
      plan: { type: "string", description: "Customer plan or tier." },
      owner: { type: "string", description: "Sales owner of the handoff." },
    },
    required: [
      "customerName",
      "customerEmail",
      "company",
      "dealSummary",
      "salesNotes",
      "plan",
      "owner",
    ],
  },
  async execute(input, context) {
    const fields = [
      "customerName",
      "customerEmail",
      "company",
      "dealSummary",
      "salesNotes",
      "plan",
      "owner",
    ] as const;
    const values = Object.fromEntries(
      fields.map((field) => [
        field,
        typeof input[field] === "string" ? input[field].trim() : "",
      ])
    ) as Record<(typeof fields)[number], string>;

    for (const field of fields) {
      if (!values[field]) {
        throw new Error(`Handoff field "${field}" is required.`);
      }
    }

    if (!values.customerEmail.includes("@")) {
      throw new Error("Customer email is invalid.");
    }

    try {
      const docRef = await adminDb.collection("handoffs").add({
        ...values,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        ...(context?.organizationId ? { organizationId: context.organizationId } : {}),
      });

      const event = await emitWorkflowEvent("customer.handoff.created", {
        handoffId: docRef.id,
        organizationId: context?.organizationId,
      });

      return {
        handoffId: docRef.id,
        status: "pending",
        customerName: values.customerName,
        company: values.company,
        eventId: event.eventId,
        handlerCount: event.handlerCount,
        failedHandlers: event.failedHandlers,
      };
    } catch (error) {
      console.error("[create_customer_handoff] Firestore error:", error);
      throw new Error("Failed to save customer handoff to Firestore.");
    }
  },
});

registerTool({
  id: "get_customer_handoff",
  name: "Get Customer Handoff",
  description: "Retrieves a customer handoff from Firestore for Customer Success processing.",
  mutatesData: false,
  requiresApproval: false,
  inputSchema: {
    type: "object",
    properties: {
      handoffId: { type: "string", description: "Firestore handoff document ID." },
    },
    required: ["handoffId"],
  },
  async execute(input) {
    const handoffId = typeof input.handoffId === "string" ? input.handoffId.trim() : "";
    if (!handoffId) {
      throw new Error("Handoff ID is required.");
    }

    try {
      const document = await adminDb.collection("handoffs").doc(handoffId).get();
      if (!document.exists) {
        throw new Error("Customer handoff was not found.");
      }

      const data = document.data() ?? {};
      const requiredFields = [
        "customerName",
        "customerEmail",
        "company",
        "dealSummary",
        "salesNotes",
        "plan",
        "owner",
        "status",
      ] as const;
      if (requiredFields.some((field) => typeof data[field] !== "string")) {
        throw new Error("Customer handoff data is invalid.");
      }

      const createdAt = data.createdAt;
      return {
        handoffId: document.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        company: data.company,
        dealSummary: data.dealSummary,
        salesNotes: data.salesNotes,
        plan: data.plan,
        owner: data.owner,
        status: data.status,
        ...(createdAt && typeof createdAt.toDate === "function"
          ? { createdAt: createdAt.toDate().toISOString() }
          : {}),
      } satisfies CustomerHandoff;
    } catch (error) {
      if (error instanceof Error && error.message === "Customer handoff was not found.") {
        throw error;
      }
      console.error("[get_customer_handoff] Firestore error:", error);
      throw new Error("Failed to retrieve customer handoff.");
    }
  },
});

registerTool({
  id: "create_onboarding_plan",
  name: "Create Onboarding Plan",
  description: "Persists a structured Customer Success onboarding plan for a handoff.",
  mutatesData: true,
  requiresApproval: false,
  inputSchema: {
    type: "object",
    properties: {
      handoffId: { type: "string", description: "Source handoff document ID." },
      onboardingPlan: { type: "object", description: "Structured onboarding plan." },
    },
    required: ["handoffId", "onboardingPlan"],
  },
  async execute(input) {
    const handoffId = typeof input.handoffId === "string" ? input.handoffId.trim() : "";
    const onboardingPlan = input.onboardingPlan as OnboardingPlan;
    if (!handoffId || !onboardingPlan || typeof onboardingPlan !== "object") {
      throw new Error("Handoff ID and onboarding plan are required.");
    }

    try {
      const handoff = await adminDb.collection("handoffs").doc(handoffId).get();
      if (!handoff.exists) {
        throw new Error("Customer handoff was not found.");
      }

      const docRef = await adminDb.collection("onboardingPlans").add({
        handoffId,
        onboardingPlan,
        status: "draft",
        createdBy: "customer_success_agent",
        createdAt: FieldValue.serverTimestamp(),
        ...(handoff.data()?.organizationId
          ? { organizationId: handoff.data()?.organizationId }
          : {}),
      });

      return { planId: docRef.id, handoffId, status: "draft" };
    } catch (error) {
      if (error instanceof Error && error.message === "Customer handoff was not found.") {
        throw error;
      }
      console.error("[create_onboarding_plan] Firestore error:", error);
      throw new Error("Failed to save onboarding plan to Firestore.");
    }
  },
});

registerTool({
  id: "create_onboarding_task",
  name: "Create Onboarding Task",
  description: "Creates an onboarding task from a persisted onboarding plan. Requires approval.",
  mutatesData: true,
  requiresApproval: true,
  inputSchema: {
    type: "object",
    properties: {
      handoffId: { type: "string", description: "Source handoff document ID." },
      onboardingPlanId: { type: "string", description: "Source onboarding plan ID." },
      title: { type: "string", description: "Task title." },
      description: { type: "string", description: "Task description." },
      priority: { type: "string", description: "Task priority: high, medium, or low." },
    },
    required: ["handoffId", "onboardingPlanId", "title", "description", "priority"],
  },
  async execute(input, context) {
    const stringFields = [
      "handoffId",
      "onboardingPlanId",
      "title",
      "description",
      "priority",
    ] as const;
    const values = Object.fromEntries(
      stringFields.map((field) => [
        field,
        typeof input[field] === "string" ? input[field].trim() : "",
      ])
    ) as Record<(typeof stringFields)[number], string>;
    if (stringFields.some((field) => !values[field])) {
      throw new Error("All onboarding task fields are required.");
    }
    if (!["high", "medium", "low"].includes(values.priority)) {
      throw new Error("Onboarding task priority is invalid.");
    }

    try {
      const plan = await adminDb.collection("onboardingPlans").doc(values.onboardingPlanId).get();
      if (!plan.exists || plan.data()?.handoffId !== values.handoffId) {
        throw new Error("Onboarding plan was not found.");
      }
      const docRef = await adminDb.collection("onboardingTasks").add({
        ...values,
        status: "pending",
        createdBy: context?.agentId ?? "customer_success_agent",
        createdAt: FieldValue.serverTimestamp(),
        ...(plan.data()?.organizationId
          ? { organizationId: plan.data()?.organizationId }
          : {}),
      });
      return {
        taskId: docRef.id,
        handoffId: values.handoffId,
        onboardingPlanId: values.onboardingPlanId,
        status: "pending",
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Onboarding plan was not found.") {
        throw error;
      }
      console.error("[create_onboarding_task] Firestore error:", error);
      throw new Error("Failed to save onboarding task to Firestore.");
    }
  },
});
