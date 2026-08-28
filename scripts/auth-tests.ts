import { NextRequest } from "next/server";
import {
  AuthError,
  getAuthenticatedUser,
  resetTokenVerifier,
  setTokenVerifier,
} from "../lib/ai/auth/firebase";

let failures = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}`);
  }
}

function request(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/workflow/handoffs", {
    headers: authorization ? { authorization } : undefined,
  });
}

async function expectAuthError(
  name: string,
  req: NextRequest,
  status: number,
  code: string
): Promise<void> {
  try {
    await getAuthenticatedUser(req);
    check(name, false);
  } catch (error) {
    check(
      name,
      error instanceof AuthError && error.status === status && error.code === code
    );
  }
}

async function main(): Promise<void> {
  resetTokenVerifier();
  await expectAuthError(
    "missing token is AUTH_MISSING_TOKEN",
    request(),
    401,
    "AUTH_MISSING_TOKEN"
  );
  await expectAuthError(
    "malformed header is AUTH_MALFORMED_TOKEN",
    request("Basic abc"),
    401,
    "AUTH_MALFORMED_TOKEN"
  );

  setTokenVerifier({
    verify: async (token) => {
      if (token === "expired") throw { code: "auth/id-token-expired" };
      if (token === "misconfigured") throw { code: "opsflow/admin-config" };
      throw { code: "auth/argument-error" };
    },
  });
  await expectAuthError(
    "rejected token is AUTH_TOKEN_INVALID",
    request("Bearer rejected"),
    401,
    "AUTH_TOKEN_INVALID"
  );
  await expectAuthError(
    "expired token is AUTH_TOKEN_EXPIRED",
    request("Bearer expired"),
    401,
    "AUTH_TOKEN_EXPIRED"
  );
  await expectAuthError(
    "Admin configuration failure is HTTP 500",
    request("Bearer misconfigured"),
    500,
    "AUTH_SERVER_MISCONFIGURED"
  );

  setTokenVerifier({
    verify: async () => ({
      uid: "user-1",
      email: "user@example.com",
      email_verified: true,
      admin: true,
    }),
  });
  const user = await getAuthenticatedUser(request("Bearer valid"));
  check(
    "verified token resolves trusted identity",
    user.uid === "user-1" && user.email === "user@example.com" && user.admin
  );

  resetTokenVerifier();
  if (failures > 0) process.exitCode = 1;
}

void main();
