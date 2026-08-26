import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import WorkflowManagement from "@/components/workflow-management";
export default function ExecutionsPage() { return <AuthGuard><AppShell><WorkflowManagement mode="executions" /></AppShell></AuthGuard>; }
