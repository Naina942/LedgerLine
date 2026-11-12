import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const existing = await prisma.account.findUnique({ where: { accountNumber: "CLEARING-INR" } });
  if (!existing) {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountNumber: "CLEARING-INR",
        isSystem: true,
        accountType: "SYSTEM",
        currency: "INR",
      },
    });
  }
  console.log("The INR clearing account is ready.");
} finally {
  await prisma.$disconnect();
}
