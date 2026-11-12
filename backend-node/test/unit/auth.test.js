import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAuthService } from "../../src/services/auth-service.js";
import { createAuthMiddleware, requireRoles } from "../../src/middleware/auth.js";

const secret = "unit-tests-use-a-long-random-looking-secret-value";

test("login verifies the stored bcrypt hash and creates a short-lived JWT session", async () => {
  const password = "a-very-long-password-for-tests";
  const passwordHash = await bcrypt.hash(password, 4);
  let createdSession;
  const prisma = {
    user: {
      findFirst: async () => ({
        id: "customer-id",
        username: "customer",
        email: "customer@example.test",
        passwordHash,
        role: "CUSTOMER",
        isActive: true,
      }),
    },
    $transaction: async (callback) => callback({
      session: { create: async ({ data }) => { createdSession = data; } },
      auditEvent: { create: async () => ({}) },
    }),
  };
  const service = createAuthService({
    prisma,
    secret,
    issuer: "balancevault-test",
    audience: "balancevault-api-test",
  });
  const result = await service.login("customer@example.test", password);
  assert.equal(await bcrypt.compare(password, passwordHash), true);
  assert.equal(result.user.role, "CUSTOMER");
  assert.equal(result.expiresIn, 900);
  assert.equal(createdSession.userId, "customer-id");
  const claims = jwt.verify(result.accessToken, secret, {
    issuer: "balancevault-test",
    audience: "balancevault-api-test",
  });
  assert.equal(claims.sub, "customer-id");
  assert.equal(claims.jti, createdSession.tokenId);
});

test("authentication rejects revoked tokens and propagates database failures", async () => {
  const middleware = createAuthMiddleware({
    prisma: {
      session: {
        findUnique: async () => ({
          id: "session-id",
          tokenId: "token-id",
          userId: "customer-id",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: new Date(),
          user: { id: "customer-id", username: "customer", role: "CUSTOMER", isActive: true },
        }),
      },
    },
    secret,
    issuer: "issuer",
    audience: "audience",
  });
  const token = jwt.sign({ sub: "customer-id", jti: "token-id" }, secret, {
    issuer: "issuer",
    audience: "audience",
    expiresIn: 60,
  });
  let authError;
  await middleware({ get: () => `Bearer ${token}` }, {}, (error) => { authError = error; });
  assert.equal(authError.status, 401);

  const databaseFailure = new Error("database unavailable");
  const failing = createAuthMiddleware({
    prisma: { session: { findUnique: async () => { throw databaseFailure; } } },
    secret,
    issuer: "issuer",
    audience: "audience",
  });
  let forwarded;
  await failing({ get: () => `Bearer ${token}` }, {}, (error) => { forwarded = error; });
  assert.equal(forwarded, databaseFailure);
});

test("role middleware enforces permissions on the API layer", () => {
  let error;
  requireRoles("ADMIN")({ user: { role: "AUDITOR" } }, {}, (value) => { error = value; });
  assert.equal(error.status, 403);
  let passed = false;
  requireRoles("AUDITOR")({ user: { role: "AUDITOR" } }, {}, () => { passed = true; });
  assert.equal(passed, true);
});
