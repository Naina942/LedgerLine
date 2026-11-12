import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapAdmin } from "../../scripts/bootstrap-admin.js";

test("admin bootstrap validates credentials before opening a database transaction", async () => {
  let opened = false;
  const prisma = {
    $transaction: async () => { opened = true; },
  };
  await assert.rejects(() => bootstrapAdmin(prisma, {
    username: "root",
    email: "root@example.com",
    password: "short",
  }), /ADMIN_BOOTSTRAP_PASSWORD/);
  assert.equal(opened, false);
});

test("admin bootstrap refuses to create a second administrator", async () => {
  const prisma = {
    $transaction: async (callback) => callback({
      $queryRaw: async () => [{ pg_advisory_xact_lock: null }],
      user: { count: async () => 1 },
    }),
  };
  await assert.rejects(() => bootstrapAdmin(prisma, {
    username: "new-admin",
    email: "admin@example.com",
    password: "valid-admin-password",
  }), /permanently closed/);
});
