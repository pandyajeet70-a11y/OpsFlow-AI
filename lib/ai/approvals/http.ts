/**
 * lib/ai/approvals/http.ts
 *
 * Shared Next.js response mapping for approval actions.
 */

import { NextResponse } from "next/server";
import type { ApprovalActionResult } from "./service";

const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  unauthorized: 403,
  already_processed: 409,
  expired: 410,
};

export function approvalActionResponse(
  result: ApprovalActionResult
): NextResponse {
  const status = STATUS_BY_CODE[result.code] ?? 200;
  return NextResponse.json(
    {
      data: {
        ok: result.ok,
        code: result.code,
        message: result.message,
        ...(result.approval ? { approval: result.approval } : {}),
        ...(result.execution ? { execution: result.execution } : {}),
      },
    },
    { status }
  );
}