/**
 * lib/ai/tools/builtins/lead-tools.ts
 *
 * Built-in lead management tools for OpsFlow.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { registerTool } from "../registry";

/* =========================================================
   Create Lead
   ========================================================= */

registerTool({
  id: "create_lead",
  name: "Create Lead",
  description:
    "Creates a new business lead and permanently saves it to OpsFlow Firestore.",

  mutatesData: true,
  requiresApproval: false,
  requiredPermission: "create_leads",

  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Full name of the lead." },
      email: { type: "string", description: "Lead contact email address." },
      company: { type: "string", description: "Lead company or organization." },
      source: {
        type: "string",
        description: "Where the lead originated (e.g. website, referral).",
      },
    },
    required: ["name", "email", "company"],
  },

  async execute(input, context) {
    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    const email =
      typeof input.email === "string"
        ? input.email.trim()
        : "";

    const company =
      typeof input.company === "string"
        ? input.company.trim()
        : "";

    const source =
      typeof input.source === "string"
        ? input.source.trim()
        : "unknown";

    if (!name) {
      throw new Error("Lead name is required.");
    }

    if (!email) {
      throw new Error("Lead email is required.");
    }

    if (!email.includes("@")) {
      throw new Error("Lead email is invalid.");
    }

    if (!company) {
      throw new Error("Lead company is required.");
    }

    const leadData = {
      name,
      email,
      company,
      source,
      status: "new",
      userId: context?.userId,
      organizationId: context?.organizationId,
      createdAt: FieldValue.serverTimestamp(),
    };

    try {
      const docRef = await adminDb
        .collection("leads")
        .add(leadData);

      const lead = {
        id: docRef.id,
        name,
        email,
        company,
        source,
        status: "new",
        createdAt: new Date().toISOString(),
      };

      console.log("[create_lead] Lead created:", lead);

      return lead;
    } catch (error) {
      console.error("[create_lead] Firestore error:", error);

      throw new Error(
        "Failed to save lead to Firestore."
      );
    }
  },
});