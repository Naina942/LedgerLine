
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { audit } from "../src/services/audit-service.js";

export async function bootstrapAdmin(prisma, { username, email, password }) {
  if (!username || username.length < 3 || username.length > 50) {
    throw new Error("ADMIN_BOOTSTRAP_USERNAME must be 3 to 50 characters");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address");
  }

  if (!password || password.length < 12 || password.length > 72) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be 12 to 72 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.$transaction(async (tx) => {
    // Acquire a transaction-level advisory lock.
    // Cast the result to an integer so Prisma can deserialize it.
    await tx.$queryRaw`
      SELECT 1::int AS locked
      FROM (SELECT pg_advisory_xact_lock(814492251)) AS lock_result
    `;

    const adminCount = await tx.user.count({
      where: { role: "ADMIN" },
    });

    if (adminCount > 0) {
      throw new Error(
        "An administrator already exists; bootstrap is permanently closed"
      );
    }

    const user = await tx.user.create({
      data: {
        id: randomUUID(),
        username,
        email: email.toLowerCase(),
        passwordHash,
        role: "ADMIN",
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });

    const clearingAccount = await tx.account.findUnique({
      where: { accountNumber: "CLEARING-INR" },
    });

    if (!clearingAccount) {
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountNumber: "CLEARING-INR",
          isSystem: true,
          accountType: "SYSTEM",
          currency: "INR",
        },
      });
    }

    await audit(tx, user.id, "ADMIN_BOOTSTRAPPED", user.id);

    return user;
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const databaseUrl =
    process.env.ADMIN_DATABASE_URL ??
    (process.env.NODE_ENV === "test"
      ? process.env.TEST_ADMIN_DATABASE_URL
      : undefined);

  if (!databaseUrl) {
    console.error(
      "Set ADMIN_DATABASE_URL to the restricted BalanceVault admin database role."
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const user = await bootstrapAdmin(prisma, {
      username: process.env.ADMIN_BOOTSTRAP_USERNAME,
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    });

    console.log(
      `Initial administrator created: ${user.username} (${user.id})`
    );
  } catch (error) {
    console.error(`Admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
