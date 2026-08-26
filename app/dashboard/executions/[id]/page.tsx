import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import WorkflowManagement from "@/components/workflow-management";
export default async function ExecutionDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AuthGuard><AppShell><WorkflowManagement mode="executions" id={id} /></AppShell></AuthGuard>; }
