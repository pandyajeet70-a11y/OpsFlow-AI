import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import WorkflowManagement from "@/components/workflow-management";
export default function HandoffsPage() { return <AuthGuard><AppShell><WorkflowManagement mode="handoffs" /></AppShell></AuthGuard>; }
