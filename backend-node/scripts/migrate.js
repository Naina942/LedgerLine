import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (!process.env.MIGRATION_DATABASE_URL) {
  console.error("Set MIGRATION_DATABASE_URL to the restricted migration-role connection string.");
  process.exit(1);
}
const prismaCli = resolve("node_modules", "prisma", "build", "index.js");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
});
process.exit(result.status ?? 1);
