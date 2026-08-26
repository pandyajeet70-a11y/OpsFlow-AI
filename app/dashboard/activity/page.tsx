import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import WorkflowManagement from "@/components/workflow-management";
export default function ActivityPage() { return <AuthGuard><AppShell><WorkflowManagement mode="activity" /></AppShell></AuthGuard>; }
