import { randomBytes } from "node:crypto";
import { HttpError } from "../errors.js";
import { audit } from "./audit-service.js";

const ACCOUNT_NUMBER_MIN = 10_000_000_000_000_000n;
const ACCOUNT_NUMBER_RANGE = 90_000_000_000_000_000n;
const RANDOM_64_BIT_RANGE = 1n << 64n;
const RANDOM_ACCEPTANCE_LIMIT =
  RANDOM_64_BIT_RANGE - (RANDOM_64_BIT_RANGE % ACCOUNT_NUMBER_RANGE);

const accountSelect = {
  id: true,
  accountNumber: true,
  accountType: true,
  status: true,
  currency: true,
  balancePaise: true,
  createdAt: true,
};

const mapAccount = (account) => ({ ...account, balancePaise: account.balancePaise.toString() });

function generateAccountNumber() {
  let value;
  do {
    value = randomBytes(8).readBigUInt64BE();
  } while (value >= RANDOM_ACCEPTANCE_LIMIT);
  return (ACCOUNT_NUMBER_MIN + (value % ACCOUNT_NUMBER_RANGE)).toString();
}

export function createAccountService(prisma) {
  return {
    async create(user, accountType) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const accountNumber = generateAccountNumber();
        try {
          return await prisma.$transaction(async (tx) => {
            const account = await tx.account.create({
              data: { accountNumber, ownerId: user.id, accountType, currency: "INR" },
              select: accountSelect,
            });
            await audit(tx, user.id, "ACCOUNT_CREATED", account.id, { accountType });
            return mapAccount(account);
          });
        } catch (error) {
          if (error?.code !== "P2002" || attempt === 4) throw error;
        }
      }
      throw new HttpError(503, "Unable to allocate a unique account number", "ACCOUNT_NUMBER_UNAVAILABLE");
    },

    async listMine(userId) {
      const accounts = await prisma.account.findMany({
        where: { ownerId: userId, isSystem: false },
        select: accountSelect,
        orderBy: { createdAt: "desc" },
      });
      return accounts.map(mapAccount);
    },

    async getMine(userId, accountNumber) {
      const account = await prisma.account.findFirst({
        where: { accountNumber, ownerId: userId, isSystem: false },
        select: accountSelect,
      });
      if (!account) throw new HttpError(404, "Account was not found", "NOT_FOUND");
      return mapAccount(account);
    },

    async updateStatus(actorId, accountId, status) {
      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.account.findUnique({ where: { id: accountId } });
        if (!account || account.isSystem) throw new HttpError(404, "Account was not found", "NOT_FOUND");
        if (status === "CLOSED" && account.balancePaise !== 0n) {
          throw new HttpError(409, "An account with a non-zero balance cannot be closed", "ACCOUNT_HAS_BALANCE");
        }
        const updated = await tx.account.update({
          where: { id: accountId },
          data: { status },
          select: accountSelect,
        });
        await audit(tx, actorId, "ACCOUNT_STATUS_CHANGED", accountId, { from: account.status, to: status });
        return updated;
      });
      return mapAccount(result);
    },
  };
}
