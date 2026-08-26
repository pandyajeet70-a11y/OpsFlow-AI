/**
 * lib/ai/tools/builtins/campaign-tools.ts
 *
 * Built-in campaign tooling for OpsFlow.
 *
 * `create_campaign` is intentionally an *approval-required* mutating tool:
 * the executor refuses to run it unless an explicit approval token is present
 * (`context.approved === true`). This demonstrates the audit/approval posture
 * production mutating tools go through before touching real data.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { registerTool } from "../registry";

/* =========================================================
   Create Campaign (approval-required)
   ========================================================= */

registerTool({
  id: "create_campaign",
  name: "Create Campaign",
  description:
    "Creates a new marketing campaign with a budget and target channel. Requires explicit approval before it can execute.",

  mutatesData: true,
  requiresApproval: true,

  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Campaign name." },
      budget: {
        type: "number",
        description: "Campaign budget in dollars (positive number). Optional — a campaign can be created with the budget to be finalized later.",
      },
      channel: {
        type: "string",
        description: "Target channel (email, social, ads, etc.).",
      },
    },
    required: ["name"],
  },

  async execute(input, context) {
    const name =
      typeof input.name === "string" ? input.name.trim() : "";

    let budget: number | null = null;
    if (input.budget !== undefined && input.budget !== null) {
      if (
        typeof input.budget !== "number" ||
        !Number.isFinite(input.budget) ||
        input.budget <= 0
      ) {
        throw new Error("Campaign budget must be a positive number.");
      }
      budget = input.budget;
    }

    const channel =
      typeof input.channel === "string"
        ? input.channel.trim()
        : "email";

    if (!name) {
      throw new Error("Campaign name is required.");
    }

    const campaignData = {
      name,
      budget,
      channel,
      status: "needs_approval",
      requestedByAgent: context?.agentId ?? null,
      requestedByUser: context?.userId ?? null,
      requestId: context?.requestId ?? null,
      createdAt: FieldValue.serverTimestamp(),
    };

    try {
      const docRef = await adminDb
        .collection("campaigns")
        .add(campaignData);

      const campaign = {
        id: docRef.id,
        name,
        budget,
        channel,
        status: "needs_approval",
        createdAt: new Date().toISOString(),
      };

      console.log("[create_campaign] Campaign created:", campaign);

      return campaign;
    } catch (error) {
      console.error("[create_campaign] Firestore error:", error);

      throw new Error(
        "Failed to save campaign to Firestore."
      );
    }
  },
});