-- Run as the database administrator before the initial Prisma migration.
-- Set each role password through a secure DBA/secret-manager workflow; never commit it.
CREATE ROLE balancevault_migrator LOGIN;
CREATE ROLE balancevault_app LOGIN;
CREATE ROLE balancevault_admin LOGIN;

GRANT CONNECT ON DATABASE balancevault TO balancevault_migrator, balancevault_app, balancevault_admin;
CREATE SCHEMA balancevault AUTHORIZATION balancevault_migrator;
GRANT USAGE ON SCHEMA balancevault TO balancevault_app, balancevault_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE balancevault_migrator IN SCHEMA balancevault
  GRANT SELECT, INSERT ON TABLES TO balancevault_app;
ALTER DEFAULT PRIVILEGES FOR ROLE balancevault_migrator IN SCHEMA balancevault
  GRANT SELECT ON TABLES TO balancevault_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE balancevault_migrator IN SCHEMA balancevault
  GRANT USAGE, SELECT ON SEQUENCES TO balancevault_app;
