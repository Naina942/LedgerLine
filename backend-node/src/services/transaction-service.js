import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { HttpError } from "../errors.js";
import { audit } from "./audit-service.js";
import { parseAmountToPaise, formatPaise } from "../validation.js";

const SYSTEM_ACCOUNT_NUMBER = "CLEARING-INR";

function hashRequest(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function isSerializationConflict(error) {
  return error?.code === "P2034" || error?.meta?.code === "40001";
}

function mapTransaction(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amount: formatPaise(transaction.amountPaise),
    amountPaise: transaction.amountPaise.toString(),
    currency: "INR",
    sourceAccountNumber: transaction.sourceAccount?.accountNumber ?? null,
    destinationAccountNumber: transaction.destinationAccount?.accountNumber ?? null,
    createdAt: transaction.createdAt,
  };
}

export function createTransactionService(prisma) {
  async function findReplay(tx, userId, key, requestHash) {
    const record = await tx.idempotencyRecord.findUnique({
      where: { userId_key: { userId, key } },
      include: {
        transaction: {
          include: { sourceAccount: true, destinationAccount: true },
        },
      },
    });
    if (!record) return null;
    if (record.requestHash !== requestHash) {
      throw new HttpError(409, "Idempotency key was already used for a different request", "IDEMPOTENCY_CONFLICT");
    }
    if (!record.transaction) {
      throw new HttpError(409, "A request with this idempotency key is still being processed", "REQUEST_IN_PROGRESS");
    }
    return mapTransaction(record.transaction);
  }

  async function lockAccounts(tx, accountNumbers) {
    for (const accountNumber of [...new Set(accountNumbers)].sort()) {
      await tx.$queryRaw`
        SELECT "id" FROM "Account"
        WHERE "accountNumber" = ${accountNumber}
        FOR UPDATE
      `;
    }
  }

  async function execute({ user, type, sourceNumber, destinationNumber, amount, idempotencyKey }) {
    if (!idempotencyKey || idempotencyKey.length > 100 || !idempotencyKey.trim()) {
      throw new HttpError(400, "A valid Idempotency-Key header is required", "INVALID_IDEMPOTENCY_KEY");
    }
    const amountPaise = parseAmountToPaise(amount);
    if ((type === "TRANSFER" || type === "WITHDRAWAL") && !sourceNumber) {
      throw new HttpError(400, "A source account is required", "INVALID_ACCOUNT");
    }
    if ((type === "TRANSFER" || type === "DEPOSIT") && !destinationNumber) {
      throw new HttpError(400, "A destination account is required", "INVALID_ACCOUNT");
    }
    if (type === "TRANSFER" && sourceNumber === destinationNumber) {
      throw new HttpError(400, "Source and destination accounts must differ", "INVALID_ACCOUNT");
    }

    const requestPayload = { type, sourceNumber: sourceNumber ?? null, destinationNumber: destinationNumber ?? null, amountPaise: amountPaise.toString() };
    const requestHash = hashRequest(requestPayload);
    const lockNumbers = [
      ...(sourceNumber ? [sourceNumber] : []),
      ...(destinationNumber ? [destinationNumber] : []),
      SYSTEM_ACCOUNT_NUMBER,
    ];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const accounts = await tx.account.findMany({
            where: { accountNumber: { in: lockNumbers } },
          });
          const byNumber = new Map(accounts.map((account) => [account.accountNumber, account]));
          const source = sourceNumber ? byNumber.get(sourceNumber) : null;
          const destination = destinationNumber ? byNumber.get(destinationNumber) : null;
          const clearing = byNumber.get(SYSTEM_ACCOUNT_NUMBER);

          if ((sourceNumber && !source) || (destinationNumber && !destination)) {
            throw new HttpError(404, "Account was not found", "NOT_FOUND");
          }
          const owned = (source ?? destination)?.ownerId === user.id;
          if (!owned || (source && source.isSystem) || (destination && destination.isSystem)) {
            throw new HttpError(404, "Account was not found", "NOT_FOUND");
          }

          const replayBeforeLock = await findReplay(tx, user.id, idempotencyKey, requestHash);
          if (replayBeforeLock) return replayBeforeLock;

          await lockAccounts(tx, lockNumbers);
          const lockedAccounts = await tx.account.findMany({
            where: { accountNumber: { in: lockNumbers } },
          });
          const lockedByNumber = new Map(lockedAccounts.map((account) => [account.accountNumber, account]));
          const lockedSource = sourceNumber ? lockedByNumber.get(sourceNumber) : null;
          const lockedDestination = destinationNumber ? lockedByNumber.get(destinationNumber) : null;
          const lockedClearing = lockedByNumber.get(SYSTEM_ACCOUNT_NUMBER);
          if (!lockedClearing) {
            throw new HttpError(503, "The transaction clearing account is not configured", "LEDGER_UNAVAILABLE");
          }

          const replayAfterLock = await findReplay(tx, user.id, idempotencyKey, requestHash);
          if (replayAfterLock) return replayAfterLock;

          for (const account of [lockedSource, lockedDestination]) {
            if (account && account.status !== "ACTIVE") {
              throw new HttpError(409, "Account is not active", "ACCOUNT_NOT_ACTIVE");
            }
          }
          if (lockedSource?.ownerId !== user.id && lockedDestination?.ownerId !== user.id) {
            throw new HttpError(404, "Account was not found", "NOT_FOUND");
          }
          if (lockedSource && lockedSource.balancePaise < amountPaise) {
            throw new HttpError(409, "Insufficient funds", "INSUFFICIENT_FUNDS");
          }

          const transactionId = randomUUID();
          const entries = [];
          const deltas = new Map();
          const addEntry = (account, side) => {
            entries.push({
              id: randomUUID(),
              transactionId,
              accountId: account.id,
              side,
              amountPaise,
            });
            const signed = side === "CREDIT" ? amountPaise : -amountPaise;
            deltas.set(account.id, (deltas.get(account.id) ?? 0n) + signed);
          };

          if (type === "DEPOSIT") {
            addEntry(lockedClearing, "DEBIT");
            addEntry(lockedDestination, "CREDIT");
          } else if (type === "WITHDRAWAL") {
            addEntry(lockedSource, "DEBIT");
            addEntry(lockedClearing, "CREDIT");
          } else {
            addEntry(lockedSource, "DEBIT");
            addEntry(lockedDestination, "CREDIT");
          }

          const transaction = await tx.transaction.create({
            data: {
              id: transactionId,
              type,
              amountPaise,
              sourceAccountId: lockedSource?.id ?? null,
              destinationAccountId: lockedDestination?.id ?? null,
              requestedById: user.id,
            },
          });
          for (const [accountId, delta] of deltas) {
            await tx.account.update({
              where: { id: accountId },
              data: { balancePaise: { increment: delta } },
            });
          }
          await tx.ledgerEntry.createMany({ data: entries });
          await tx.idempotencyRecord.create({
            data: {
              userId: user.id,
              key: idempotencyKey,
              requestHash,
              transactionId,
            },
          });
          await audit(tx, user.id, `TRANSACTION_${type}`, transactionId, { amountPaise: amountPaise.toString() });
          const withAccounts = await tx.transaction.findUnique({
            where: { id: transactionId },
            include: { sourceAccount: true, destinationAccount: true },
          });
          return mapTransaction(withAccounts ?? transaction);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      } catch (error) {
        if (error instanceof HttpError) throw error;
        if (isSerializationConflict(error) && attempt < 2) continue;
        if (error?.code === "P2002") {
          const replay = await findReplay(prisma, user.id, idempotencyKey, requestHash);
          if (replay) return replay;
          throw new HttpError(409, "Request conflicts with an existing transaction", "IDEMPOTENCY_CONFLICT");
        }
        throw error;
      }
    }
    throw new HttpError(503, "Transaction could not be completed safely; retry with the same idempotency key", "TRANSACTION_RETRY_REQUIRED");
  }

  return {
    deposit: async () => {
      throw new HttpError(503, "Deposits are unavailable until a payment settlement provider is configured", "DEPOSITS_UNAVAILABLE");
    },
    withdraw: ({ user, accountNumber, amount, idempotencyKey }) =>
      execute({ user, type: "WITHDRAWAL", sourceNumber: accountNumber, amount, idempotencyKey }),
    transfer: ({ user, fromAccountNumber, toAccountNumber, amount, idempotencyKey }) =>
      execute({ user, type: "TRANSFER", sourceNumber: fromAccountNumber, destinationNumber: toAccountNumber, amount, idempotencyKey }),
    async listForCustomer(userId, { page, pageSize, type }) {
      const skip = (page - 1) * pageSize;
      const where = {
        ...(type ? { type } : {}),
        OR: [
          { sourceAccount: { ownerId: userId } },
          { destinationAccount: { ownerId: userId } },
        ],
      };
      const [items, total] = await Promise.all([prisma.transaction.findMany({
        where,
        include: { sourceAccount: true, destinationAccount: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }), prisma.transaction.count({ where })]);
      return { items: items.map(mapTransaction), page, pageSize, total };
    },
    async listAll({ page, pageSize, type }) {
      const where = type ? { type } : {};
      const [items, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: { sourceAccount: true, destinationAccount: true },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.transaction.count({ where }),
      ]);
      return { items: items.map(mapTransaction), page, pageSize, total };
    },
    async getForCustomer(userId, transactionId) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          OR: [
            { sourceAccount: { ownerId: userId } },
            { destinationAccount: { ownerId: userId } },
          ],
        },
        include: {
          sourceAccount: true,
          destinationAccount: true,
          ledgerEntries: { select: { side: true, amountPaise: true, createdAt: true } },
        },
      });
      if (!transaction) throw new HttpError(404, "Transaction was not found", "NOT_FOUND");
      return {
        ...mapTransaction(transaction),
        ledgerEntries: transaction.ledgerEntries.map((entry) => ({
          side: entry.side,
          amountPaise: entry.amountPaise.toString(),
          createdAt: entry.createdAt,
        })),
      };
    },
  };
}
