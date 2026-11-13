
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

const adminUrl = process.env.DATABASE_PROVISIONER_URL;

if (!adminUrl) {
  console.error("DATABASE_PROVISIONER_URL is missing.");
  process.exit(1);
}

const client = new Client({
  connectionString: adminUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();

  const result = await client.query(`
    SELECT current_database() AS database,
           current_user AS username
  `);

  console.log("Connected to:", result.rows[0].database);
  console.log("Connected as database administrator.");

  const sql = await readFile(
    resolve("prisma", "permissions.sql"),
    "utf8"
  );

  await client.query("BEGIN");

  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  console.log("Database permissions applied successfully.");
} catch (error) {
  console.error("Failed to apply database permissions:");
  console.error(error.code || "", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
