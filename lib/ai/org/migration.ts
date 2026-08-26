import { adminDb } from "@/lib/firebase-admin";

const WORKFLOW_COLLECTIONS = ["handoffs", "onboardingPlans", "onboardingTasks", "executions", "approvals", "workflowEvents", "auditEvents"] as const;

export interface MigrationReport {
  dryRun: boolean;
  updated: number;
  skipped: number;
}

export async function assignOrganizationToLegacyData(
  organizationId: string,
  dryRun = true
): Promise<MigrationReport> {
  if (!organizationId.trim()) throw new Error("organizationId is required.");
  const report: MigrationReport = { dryRun, updated: 0, skipped: 0 };
  for (const collection of WORKFLOW_COLLECTIONS) {
    const snapshot = await adminDb.collection(collection).get();
    for (const document of snapshot.docs) {
      if (document.data().organizationId) {
        report.skipped += 1;
      } else {
        report.updated += 1;
        if (!dryRun) await document.ref.update({ organizationId });
      }
    }
  }
  return report;
}
