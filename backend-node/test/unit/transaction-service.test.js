import test from "node:test";
import assert from "node:assert/strict";
import { createTransactionService } from "../../src/services/transaction-service.js";

test("customer deposits fail closed until payment settlement is configured", async () => {
  let transactionStarted = false;
  const service = createTransactionService({
    $transaction: async () => {
      transactionStarted = true;
    },
  });

  await assert.rejects(
    () => service.deposit({
      user: { id: "customer-id" },
      accountNumber: "12345678901234567",
      amount: "100.00",
      idempotencyKey: "unverified-payment",
    }),
    (error) => error.status === 503 && error.code === "DEPOSITS_UNAVAILABLE",
  );
  assert.equal(transactionStarted, false);
});

test("withdrawals retry PostgreSQL serialization failures from row locks", async () => {
  let transactionAttempts = 0;
  let lockAttempts = 0;
  let accountUpdates = 0;
  const account = {
    id: "customer-account-id",
    accountNumber: "12345678901234567",
    ownerId: "customer-id",
    isSystem: false,
    status: "ACTIVE",
    balancePaise: 1000n,
  };
  const clearingAccount = {
    id: "clearing-account-id",
    accountNumber: "CLEARING-INR",
    ownerId: null,
    isSystem: true,
    status: "ACTIVE",
    balancePaise: 0n,
  };
  const transaction = {
    id: "transaction-id",
    type: "WITHDRAWAL",
    status: "POSTED",
    amountPaise: 100n,
    createdAt: new Date(),
    sourceAccount: account,
    destinationAccount: null,
  };
  const prisma = {
    $transaction: async (callback) => {
      transactionAttempts += 1;
      return callback({
        account: {
          findMany: async ({ where }) => (
            where.accountNumber.in.includes(account.accountNumber)
              ? [account, clearingAccount]
              : [clearingAccount]
          ),
          update: async () => { accountUpdates += 1; },
        },
        $queryRaw: async () => {
          lockAttempts += 1;
          if (lockAttempts === 1) {
            const error = new Error("serialization failure");
            error.code = "P2010";
            error.meta = { code: "40001" };
            throw error;
          }
        },
        idempotencyRecord: { findUnique: async () => null, create: async () => ({}) },
        transaction: { create: async () => transaction, findUnique: async () => transaction },
        ledgerEntry: { createMany: async () => ({ count: 2 }) },
        auditEvent: { create: async () => ({}) },
      });
    },
  };

  const result = await createTransactionService(prisma).withdraw({
    user: { id: "customer-id" },
    accountNumber: account.accountNumber,
    amount: "1.00",
    idempotencyKey: "withdrawal-retry",
  });

  assert.equal(result.id, "transaction-id");
  assert.equal(transactionAttempts, 2);
  assert.equal(accountUpdates, 2);
});
