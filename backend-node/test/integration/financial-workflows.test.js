import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { bootstrapAdmin } from "../../scripts/bootstrap-admin.js";
import { createApp } from "../../src/app.js";

const prisma = new PrismaClient();
const adminDatabaseUrl = process.env.TEST_ADMIN_DATABASE_URL;
const adminPrisma = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

class TestRedis {
  constructor() {
    this.counts = new Map();
  }
  async incr(key) {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return count;
  }
  async pexpire() {}
  async pttl() { return 60_000; }
  async ping() { return "PONG"; }
}

const config = {
  jwtSecret: "this-is-a-test-only-secret-with-more-than-32-characters",
  jwtIssuer: "balancevault-test",
  jwtAudience: "balancevault-api-test",
  frontendOrigin: "http://localhost:5173",
  rateLimitWindowMs: 60_000,
  rateLimitLoginMax: 20,
  rateLimitRegisterMax: 20,
  rateLimitTransactionMax: 100,
  trustProxyHops: 0,
};

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function ensureClearingAccount() {
  const accountNumber = "CLEARING-INR";
  if (await adminPrisma.account.findUnique({ where: { accountNumber } })) return;
  await adminPrisma.account.create({
    data: {
      accountNumber,
      isSystem: true,
      accountType: "SYSTEM",
      currency: "INR",
    },
  });
}

async function ensureBootstrapAdmin() {
  const existingAdmin = await adminPrisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (existingAdmin) return;

  const suffix = randomUUID().replaceAll("-", "");
  await bootstrapAdmin(adminPrisma, {
    username: `bootstrap_${suffix.slice(0, 20)}`,
    email: `bootstrap_${suffix}@example.test`,
    password: randomUUID(),
  });
}

async function fundAccountForTest(userId, accountId, amountPaise) {
  const clearingAccount = await prisma.account.findUnique({
    where: { accountNumber: "CLEARING-INR" },
    select: { id: true },
  });
  assert.ok(clearingAccount, "test clearing account must exist");

  const transactionId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        id: transactionId,
        type: "DEPOSIT",
        amountPaise,
        destinationAccountId: accountId,
        requestedById: userId,
      },
    });
    await tx.account.update({
      where: { id: clearingAccount.id },
      data: { balancePaise: { decrement: amountPaise } },
    });
    await tx.account.update({
      where: { id: accountId },
      data: { balancePaise: { increment: amountPaise } },
    });
    await tx.ledgerEntry.createMany({
      data: [
        {
          id: randomUUID(),
          transactionId,
          accountId: clearingAccount.id,
          side: "DEBIT",
          amountPaise,
        },
        {
          id: randomUUID(),
          transactionId,
          accountId,
          side: "CREDIT",
          amountPaise,
        },
      ],
    });
    await tx.auditEvent.create({
      data: {
        actorId: userId,
        action: "TEST_PAYMENT_SETTLED",
        subjectId: transactionId,
        metadata: { amountPaise: amountPaise.toString() },
      },
    });
  });
  return { id: transactionId, amountPaise: amountPaise.toString() };
}

test("full financial API, RBAC, database safety and concurrent withdrawals", async (t) => {
  await ensureBootstrapAdmin();
  await ensureClearingAccount();
  const redis = new TestRedis();
  const app = createApp({ prisma, redis, config });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const customer = {
    username: `customer_${suffix}`.slice(0, 50),
    email: `customer_${suffix}@example.test`,
    password: "correct-horse-battery-staple",
  };

  await t.test("health, registration, hashing, login, and customer RBAC", async () => {
    assert.equal((await request(app).get("/health")).status, 200);
    assert.equal((await request(app).get("/ready")).status, 200);

    const roleInjection = await request(app).post("/api/auth/register").send({
      ...customer,
      role: "ADMIN",
    });
    assert.equal(roleInjection.status, 400);

    const registered = await request(app).post("/api/auth/register").send(customer);
    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.role, "CUSTOMER");
    const stored = await prisma.user.findUnique({ where: { id: registered.body.user.id } });
    assert.notEqual(stored.passwordHash, customer.password);
    assert.equal(await bcrypt.compare(customer.password, stored.passwordHash), true);

    const loggedIn = await request(app).post("/api/auth/login").send({
      login: customer.email,
      password: customer.password,
    });
    assert.equal(loggedIn.status, 200);
    const token = loggedIn.body.accessToken;
    assert.equal((await request(app).get("/api/auth/me").set(auth(token))).status, 200);
    assert.equal((await request(app).get("/api/admin/users").set(auth(token))).status, 403);
    assert.equal((await request(app).get("/api/audit").set(auth(token))).status, 403);
    const logout = await request(app).post("/api/auth/logout").set(auth(token));
    assert.equal(logout.status, 200);
    assert.equal((await request(app).get("/api/auth/me").set(auth(token))).status, 401);
  });

  const loggedIn = await request(app).post("/api/auth/login").send({
    login: customer.username,
    password: customer.password,
  });
  assert.equal(loggedIn.status, 200);
  const customerToken = loggedIn.body.accessToken;
  const customerId = loggedIn.body.user.id;

  let firstAccount;
  let firstDeposit;
  let receiverAccount;
  await t.test("account ownership, exact deposits, withdrawals, transfers and idempotency", async () => {
    const created = await request(app).post("/api/accounts").set(auth(customerToken)).send({ accountType: "SAVINGS" });
    assert.equal(created.status, 201);
    firstAccount = created.body.account;
    assert.equal(firstAccount.balancePaise, "0");
    assert.equal((await request(app).get(`/api/accounts/${firstAccount.accountNumber}`).set(auth(customerToken))).status, 200);

    const deposit = await request(app).post("/api/transactions/deposit")
      .set(auth(customerToken)).set("Idempotency-Key", `deposit-${suffix}`)
      .send({ accountNumber: firstAccount.accountNumber, amount: "100.00" });
    assert.equal(deposit.status, 503);
    assert.equal(deposit.body.error, "DEPOSITS_UNAVAILABLE");
    assert.equal((await prisma.account.findUnique({ where: { id: firstAccount.id } })).balancePaise, 0n);
    firstDeposit = await fundAccountForTest(customerId, firstAccount.id, 10000n);
    assert.equal(firstDeposit.amountPaise, "10000");
    assert.equal((await prisma.account.findUnique({ where: { id: firstAccount.id } })).balancePaise, 10000n);

    const duplicateDeposit = await request(app).post("/api/transactions/deposit")
      .set(auth(customerToken)).set("Idempotency-Key", `deposit-${suffix}`)
      .send({ accountNumber: firstAccount.accountNumber, amount: "100.00" });
    assert.equal(duplicateDeposit.status, 503);
    assert.equal((await prisma.account.findUnique({ where: { id: firstAccount.id } })).balancePaise, 10000n);

    const withdrawal = await request(app).post("/api/transactions/withdraw")
      .set(auth(customerToken)).set("Idempotency-Key", `withdraw-${suffix}`)
      .send({ accountNumber: firstAccount.accountNumber, amount: "20.00" });
    assert.equal(withdrawal.status, 201);

    const receiver = await request(app).post("/api/accounts").set(auth(customerToken)).send({ accountType: "CURRENT" });
    assert.equal(receiver.status, 201);
    receiverAccount = receiver.body.account;
    const transfer = await request(app).post("/api/transactions/transfer")
      .set(auth(customerToken)).set("Idempotency-Key", `transfer-${suffix}`)
      .send({
        fromAccountNumber: firstAccount.accountNumber,
        toAccountNumber: receiverAccount.accountNumber,
        amount: "10.25",
      });
    assert.equal(transfer.status, 201);
    assert.equal((await prisma.account.findUnique({ where: { id: firstAccount.id } })).balancePaise, 6975n);
    const duplicateTransfer = await request(app).post("/api/transactions/transfer")
      .set(auth(customerToken)).set("Idempotency-Key", `transfer-${suffix}`)
      .send({
        fromAccountNumber: firstAccount.accountNumber,
        toAccountNumber: receiverAccount.accountNumber,
        amount: "10.25",
      });
    assert.equal(duplicateTransfer.status, 201);
    assert.equal(duplicateTransfer.body.transaction.id, transfer.body.transaction.id);
    const mismatchedTransfer = await request(app).post("/api/transactions/transfer")
      .set(auth(customerToken)).set("Idempotency-Key", `transfer-${suffix}`)
      .send({
        fromAccountNumber: firstAccount.accountNumber,
        toAccountNumber: receiverAccount.accountNumber,
        amount: "10.26",
      });
    assert.equal(mismatchedTransfer.status, 409);
    assert.equal((await prisma.account.findUnique({ where: { id: firstAccount.id } })).balancePaise, 6975n);

    const entries = await prisma.ledgerEntry.findMany({ where: { transactionId: transfer.body.transaction.id } });
    assert.equal(entries.length, 2);
    assert.equal(entries.filter((entry) => entry.side === "DEBIT").reduce((sum, entry) => sum + entry.amountPaise, 0n), 1025n);
    assert.equal(entries.filter((entry) => entry.side === "CREDIT").reduce((sum, entry) => sum + entry.amountPaise, 0n), 1025n);

    const badPrecision = await request(app).post("/api/transactions/withdraw")
      .set(auth(customerToken)).set("Idempotency-Key", `invalid-${suffix}`)
      .send({ accountNumber: firstAccount.accountNumber, amount: "1.001" });
    assert.equal(badPrecision.status, 400);
    const history = await request(app).get("/api/transactions/my?type=TRANSFER").set(auth(customerToken));
    assert.equal(history.status, 200);
    assert.equal(history.body.items.every((item) => item.type === "TRANSFER"), true);
  });

  await t.test("customer isolation, auditor read-only access, admin bootstrap, and append-only records", async () => {
    const other = {
      username: `other_${suffix}`.slice(0, 50),
      email: `other_${suffix}@example.test`,
      password: "correct-horse-battery-staple",
    };
    const otherRegistration = await request(app).post("/api/auth/register").send(other);
    assert.equal(otherRegistration.status, 201);
    const otherLogin = await request(app).post("/api/auth/login").send({ login: other.username, password: other.password });
    const otherToken = otherLogin.body.accessToken;
    const otherAccount = await request(app).post("/api/accounts").set(auth(otherToken)).send({ accountType: "SAVINGS" });
    const privateDeposit = await request(app).post("/api/transactions/deposit")
      .set(auth(otherToken)).set("Idempotency-Key", `other-deposit-${suffix}`)
      .send({ accountNumber: otherAccount.body.account.accountNumber, amount: "5.00" });
    assert.equal(privateDeposit.status, 503);
    const otherFunding = await fundAccountForTest(
      otherLogin.body.user.id,
      otherAccount.body.account.id,
      500n,
    );
    assert.equal((await request(app).get(`/api/accounts/${otherAccount.body.account.accountNumber}`).set(auth(customerToken))).status, 404);
    assert.equal((await request(app).get(`/api/transactions/${otherFunding.id}`).set(auth(customerToken))).status, 404);
    assert.equal((await request(app).post("/api/transactions/withdraw").set(auth(customerToken))
      .set("Idempotency-Key", `foreign-${suffix}`)
      .send({ accountNumber: otherAccount.body.account.accountNumber, amount: "1.00" })).status, 404);

    const auditorPassword = "auditor-password-long-enough";
    const auditor = await prisma.user.create({
      data: {
        username: `auditor_${suffix}`.slice(0, 50),
        email: `auditor_${suffix}@example.test`,
        passwordHash: await bcrypt.hash(auditorPassword, 12),
        role: "AUDITOR",
      },
    });
    const auditorLogin = await request(app).post("/api/auth/login").send({
      login: auditor.username,
      password: auditorPassword,
    });
    const auditorToken = auditorLogin.body.accessToken;
    const auditResponse = await request(app).get("/api/audit").set(auth(auditorToken));
    assert.equal(auditResponse.status, 200);
    const auditorTransactions = await request(app).get("/api/transactions").set(auth(auditorToken));
    assert.equal(auditorTransactions.status, 200);
    assert.equal("sourceAccountNumber" in auditorTransactions.body.items[0], false);
    assert.equal((await request(app).post("/api/transactions/deposit").set(auth(auditorToken))
      .set("Idempotency-Key", `auditor-${suffix}`)
      .send({ accountNumber: firstAccount.accountNumber, amount: "1.00" })).status, 403);
    assert.equal((await request(app).get("/api/accounts").set(auth(auditorToken))).status, 403);

    await assert.rejects(() => bootstrapAdmin(adminPrisma, {
      username: `admin2_${suffix}`.slice(0, 50),
      email: `admin2_${suffix}@example.test`,
      password: "another-secure-password",
    }), /permanently closed/);
    const adminPassword = "secure-bootstrap-password";
    const admin = await adminPrisma.user.create({
      data: {
        id: randomUUID(),
        username: `admin_${suffix}`.slice(0, 50),
        email: `admin_${suffix}@example.test`,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
      },
      select: { id: true, username: true, email: true, role: true },
    });
    assert.equal(admin.role, "ADMIN");
    const adminLogin = await request(app).post("/api/auth/login").send({
      login: admin.username,
      password: adminPassword,
    });
    const adminToken = adminLogin.body.accessToken;
    const userList = await request(app).get("/api/admin/users").set(auth(adminToken));
    assert.equal(userList.status, 200);
    assert.equal(userList.body.items.some((item) => item.id === auditor.id), true);

    const frozen = await request(app).patch(`/api/admin/accounts/${firstAccount.id}/status`)
      .set(auth(adminToken)).send({ status: "FROZEN" });
    assert.equal(frozen.status, 200);
    const frozenWithdrawal = await request(app).post("/api/transactions/withdraw")
      .set(auth(customerToken)).set("Idempotency-Key", `frozen-${suffix}`)
      .send({ accountNumber: firstAccount.accountNumber, amount: "1.00" });
    assert.equal(frozenWithdrawal.status, 409);
    assert.equal(frozenWithdrawal.body.error, "ACCOUNT_NOT_ACTIVE");

    const reopened = await request(app).patch(`/api/admin/accounts/${firstAccount.id}/status`)
      .set(auth(adminToken)).send({ status: "ACTIVE" });
    assert.equal(reopened.status, 200);
    const nonemptyClose = await request(app).patch(`/api/admin/accounts/${firstAccount.id}/status`)
      .set(auth(adminToken)).send({ status: "CLOSED" });
    assert.equal(nonemptyClose.status, 409);
    assert.equal(nonemptyClose.body.error, "ACCOUNT_HAS_BALANCE");

    const emptyAccountResponse = await request(app).post("/api/accounts")
      .set(auth(customerToken)).send({ accountType: "SAVINGS" });
    assert.equal(emptyAccountResponse.status, 201);
    const emptyAccount = emptyAccountResponse.body.account;
    const closedReceiver = await request(app).patch(`/api/admin/accounts/${emptyAccount.id}/status`)
      .set(auth(adminToken)).send({ status: "CLOSED" });
    assert.equal(closedReceiver.status, 200);
    const closedAccountTransfer = await request(app).post("/api/transactions/transfer")
      .set(auth(customerToken)).set("Idempotency-Key", `closed-${suffix}`)
      .send({
        fromAccountNumber: firstAccount.accountNumber,
        toAccountNumber: emptyAccount.accountNumber,
        amount: "1.00",
      });
    assert.equal(closedAccountTransfer.status, 409);
    assert.equal(closedAccountTransfer.body.error, "ACCOUNT_NOT_ACTIVE");

    const ledgerEntry = await prisma.ledgerEntry.findFirst({ where: { transactionId: firstDeposit.id } });
    await assert.rejects(() => prisma.ledgerEntry.update({
      where: { id: ledgerEntry.id },
      data: { amountPaise: 1n },
    }));
    assert.equal((await prisma.ledgerEntry.findUnique({ where: { id: ledgerEntry.id } })).amountPaise, 10000n);
  });

  await t.test("simultaneous withdrawals cannot overdraw and failures leave no partial writes", async () => {
    const balanceAccount = await request(app).post("/api/accounts").set(auth(customerToken)).send({ accountType: "SAVINGS" });
    const accountNumber = balanceAccount.body.account.accountNumber;
    await fundAccountForTest(customerId, balanceAccount.body.account.id, 1000n);
    const before = await prisma.transaction.count({
      where: {
        OR: [
          { sourceAccount: { accountNumber } },
          { destinationAccount: { accountNumber } },
        ],
      },
    });
    const simultaneous = await Promise.all([1, 2].map((number) =>
      request(app).post("/api/transactions/withdraw").set(auth(customerToken))
        .set("Idempotency-Key", `concurrent-${suffix}-${number}`)
        .send({ accountNumber, amount: "8.00" })));
    assert.deepEqual(simultaneous.map((response) => response.status).sort(), [201, 409]);
    const final = await prisma.account.findUnique({ where: { id: balanceAccount.body.account.id } });
    assert.equal(final.balancePaise, 200n);
    const after = await prisma.transaction.count({
      where: {
        OR: [
          { sourceAccount: { accountNumber } },
          { destinationAccount: { accountNumber } },
        ],
      },
    });
    assert.equal(after, before + 1);
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        transaction: {
          OR: [
            { sourceAccount: { accountNumber } },
            { destinationAccount: { accountNumber } },
          ],
        },
      },
    });
    const transactionIds = [...new Set(entries.map((entry) => entry.transactionId))];
    for (const transactionId of transactionIds) {
      const postings = entries.filter((entry) => entry.transactionId === transactionId);
      const debit = postings.filter((entry) => entry.side === "DEBIT").reduce((sum, item) => sum + item.amountPaise, 0n);
      const credit = postings.filter((entry) => entry.side === "CREDIT").reduce((sum, item) => sum + item.amountPaise, 0n);
      assert.equal(debit, credit);
    }
  });
});

test.after(async () => {
  await Promise.all([prisma.$disconnect(), adminPrisma.$disconnect()]);
});
