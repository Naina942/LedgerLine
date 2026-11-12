import test from "node:test";
import assert from "node:assert/strict";
import { createAccountService } from "../../src/services/account-service.js";

test("account creation generates a 17-digit string and retries unique conflicts", async () => {
  const createdAccounts = [];
  const auditEvents = [];
  let createCalls = 0;
  const prisma = {
    $transaction: async (callback) => callback({
      account: {
        create: async ({ data }) => {
          createCalls += 1;
          createdAccounts.push(data);
          if (createCalls === 1) {
            const error = new Error("unique constraint violation");
            error.code = "P2002";
            throw error;
          }
          return {
            ...data,
            id: "account-id",
            status: "ACTIVE",
            balancePaise: 0n,
            createdAt: new Date(),
          };
        },
      },
      auditEvent: {
        create: async ({ data }) => auditEvents.push(data),
      },
    }),
  };

  const account = await createAccountService(prisma).create(
    { id: "customer-id" },
    "SAVINGS",
  );

  assert.equal(typeof account.accountNumber, "string");
  assert.match(account.accountNumber, /^\d{17}$/);
  assert.equal(createdAccounts.length, 2);
  assert.notEqual(createdAccounts[0].accountNumber, createdAccounts[1].accountNumber);
  assert.equal(auditEvents.length, 1);
  assert.equal(account.balancePaise, "0");
});
