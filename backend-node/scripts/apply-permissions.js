import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

if (!process.env.DATABASE_PROVISIONER_URL) {
  throw new Error("DATABASE_PROVISIONER_URL is required to apply database permissions");
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_PROVISIONER_URL,
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  await client.query(await readFile(resolve("prisma", "permissions.sql"), "utf8"));
  console.log("BalanceVault application and administrative permissions are up to date.");
} finally {
  await client.end();
}
