import { NextResponse } from "next/server";
import { runtimeStatus } from "@/lib/ai/config/runtime";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "opsflow-ai", timestamp: new Date().toISOString(), configuration: runtimeStatus() });
}