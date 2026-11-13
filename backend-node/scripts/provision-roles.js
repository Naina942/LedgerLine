
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const adminUrl = process.env.DATABASE_PROVISIONER_URL;

if (!adminUrl) {
  console.error("DATABASE_PROVISIONER_URL is missing.");
  process.exit(1);
}

const roles = [
  {
    name: "balancevault_migrator",
    password: process.env.BALANCEVAULT_MIGRATOR_PASSWORD,
  },
  {
    name: "balancevault_app",
    password: process.env.BALANCEVAULT_APP_PASSWORD,
  },
  {
    name: "balancevault_admin",
    password: process.env.BALANCEVAULT_ADMIN_PASSWORD,
  },
];

for (const role of roles) {
  if (!role.password) {
    console.error(`Missing password for ${role.name}. Check your .env file.`);
    process.exit(1);
  }
}

const ssl = { rejectUnauthorized: false };

function sqlLiteral(value) {
  return "'" + value.replace(/'/g, "''") + "'";
}

const client = new Client({
  connectionString: adminUrl,
  ssl,
  connectionTimeoutMillis: 15000,
});

let migratorClient;

try {
  await client.connect();

  const databaseName = decodeURIComponent(
    new URL(adminUrl).pathname.replace(/^\/+/, "")
  );

  console.log("Connected to database:", databaseName);

  // Create or update restricted database roles.
  for (const role of roles) {
    const result = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [role.name]
    );

    if (result.rowCount === 0) {
      await client.query(
        `CREATE ROLE ${role.name} LOGIN PASSWORD ${sqlLiteral(role.password)}`
      );
      console.log(`Created role: ${role.name}`);
    } else {
      await client.query(
        `ALTER ROLE ${role.name} WITH LOGIN PASSWORD ${sqlLiteral(role.password)}`
      );
      console.log(`Updated role: ${role.name}`);
    }

    await client.query(
      `GRANT CONNECT ON DATABASE "${databaseName}" TO ${role.name}`
    );
  }

  // Prisma migrations use the public schema.
  await client.query(`
    GRANT USAGE ON SCHEMA public
    TO balancevault_app, balancevault_admin
  `);

  await client.query(`
    GRANT USAGE, CREATE ON SCHEMA public
    TO balancevault_migrator
  `);

  console.log("Database roles configured for public schema.");

  await client.end();

  // Verify the migration role can connect.
  const migratorUrl = new URL(adminUrl);
  migratorUrl.username = "balancevault_migrator";
  migratorUrl.password = process.env.BALANCEVAULT_MIGRATOR_PASSWORD;

  migratorClient = new Client({
    connectionString: migratorUrl.toString(),
    ssl,
    connectionTimeoutMillis: 15000,
  });

  await migratorClient.connect();

  const result = await migratorClient.query(`
    SELECT current_database() AS database,
           current_user AS username
  `);

  console.log("Migration role verified:", result.rows[0].username);
  console.log("Target database:", result.rows[0].database);
  console.log("Database role provisioning completed successfully.");

} catch (error) {
  console.error("Database role provisioning failed:");
  console.error(error.code || "", error.message);
  process.exitCode = 1;

} finally {
  if (migratorClient) {
    await migratorClient.end().catch(() => {});
  }

  if (!client.ended) {
    await client.end().catch(() => {});
  }
}
