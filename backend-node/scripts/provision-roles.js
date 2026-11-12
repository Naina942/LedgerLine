
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const adminUrl = process.env.DATABASE_PROVISIONER_URL;

if (!adminUrl) {
  throw new Error(
    "DATABASE_PROVISIONER_URL is required for database role provisioning"
  );
}

// Extract and validate the target database name
const databaseName = decodeURIComponent(
  new URL(adminUrl).pathname.replace(/^\/+/, "")
);

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error(
    "The target database name may contain only letters, numbers, and underscores"
  );
}

// Database roles and their passwords
const roles = [
  ["balancevault_migrator", process.env.BALANCEVAULT_MIGRATOR_PASSWORD],
  ["balancevault_app", process.env.BALANCEVAULT_APP_PASSWORD],
  ["balancevault_admin", process.env.BALANCEVAULT_ADMIN_PASSWORD],
];

// Validate passwords before connecting
for (const [name, password] of roles) {
  if (!password || password.length < 24) {
    throw new Error(
      `${name} requires a password of at least 24 characters in the local environment`
    );
  }
}

const client = new Client({
  connectionString: adminUrl,
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();

  // Create or update database roles
  for (const [name, password] of roles) {
    const exists = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1::text",
      [name]
    );

    if (exists.rowCount === 0) {
      await client.query(`CREATE ROLE ${name} LOGIN`);
    }

    // Explicit casts prevent PostgreSQL parameter type inference errors
    const command = await client.query(
      "SELECT format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS command",
      [name, password]
    );

    await client.query(command.rows[0].command);
  }

  // Grant connection to the target database
  await client.query(
    `GRANT CONNECT ON DATABASE "${databaseName}" TO balancevault_migrator, balancevault_app, balancevault_admin`
  );

  // Check whether application schema exists
  const schema = await client.query(
    "SELECT 1 FROM information_schema.schemata WHERE schema_name = $1::text",
    ["balancevault"]
  );

  // Create schema if it does not exist
  if (schema.rowCount === 0) {
    await client.query(
      "CREATE SCHEMA balancevault AUTHORIZATION balancevault_migrator"
    );
  }

  // Explicit schema permissions
  await client.query(
    "GRANT USAGE, CREATE ON SCHEMA balancevault TO balancevault_migrator"
  );

  await client.query(
    "GRANT USAGE ON SCHEMA balancevault TO balancevault_app, balancevault_admin"
  );

  // Default table permissions for future migrations
  await client.query(`
    ALTER DEFAULT PRIVILEGES
    FOR ROLE balancevault_migrator
    IN SCHEMA balancevault
    GRANT SELECT, INSERT ON TABLES TO balancevault_app;

    ALTER DEFAULT PRIVILEGES
    FOR ROLE balancevault_migrator
    IN SCHEMA balancevault
    GRANT SELECT ON TABLES TO balancevault_admin;

    ALTER DEFAULT PRIVILEGES
    FOR ROLE balancevault_migrator
    IN SCHEMA balancevault
    GRANT USAGE, SELECT ON SEQUENCES TO balancevault_app;
  `);

  console.log("BalanceVault database roles are provisioned successfully.");
  console.log(`Target database: ${databaseName}`);
} catch (error) {
  console.error("Database role provisioning failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
