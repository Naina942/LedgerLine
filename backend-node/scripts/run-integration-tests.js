
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const testUrl = process.env.TEST_DATABASE_URL;
const testAdminUrl = process.env.TEST_ADMIN_DATABASE_URL;

if (!testUrl || !testAdminUrl) {
  console.error(
    "Set TEST_DATABASE_URL and TEST_ADMIN_DATABASE_URL to the same dedicated disposable test database."
  );
  process.exit(1);
}

let databaseName;
let adminDatabaseName;

try {
  databaseName = decodeURIComponent(
    new URL(testUrl).pathname.replace(/^\/+/, "")
  ).toLowerCase();

  adminDatabaseName = decodeURIComponent(
    new URL(testAdminUrl).pathname.replace(/^\/+/, "")
  ).toLowerCase();
} catch {
  console.error("A test database URL is not a valid PostgreSQL URL.");
  process.exit(1);
}

if (
  databaseName !== adminDatabaseName ||
  !/(^|[_-])test([_-]|$)/.test(databaseName)
) {
  console.error(
    "Refusing to run integration tests: test database name must contain a distinct 'test' segment."
  );
  process.exit(1);
}

const projectRoot = resolve(here, "..");
const integrationDirectory = resolve(projectRoot, "test", "integration");

const integrationTests = readdirSync(integrationDirectory)
  .filter((name) => name.endsWith(".test.js"))
  .map((name) => resolve(integrationDirectory, name));

if (integrationTests.length === 0) {
  console.error("No integration tests were found.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--test", ...integrationTests],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: testUrl,
      ADMIN_DATABASE_URL: testAdminUrl,
    },
  }
);

process.exit(result.status ?? 1);
