
-- Run as the Render database administrator.
-- Prisma application tables are in the public schema.

GRANT USAGE ON SCHEMA public
TO balancevault_app, balancevault_admin;

-- Application permissions (exclude _prisma_migrations).
GRANT SELECT, INSERT ON
  public."User",
  public."Account",
  public."Transaction",
  public."LedgerEntry",
  public."IdempotencyRecord",
  public."Session",
  public."AuditEvent"
TO balancevault_app;

GRANT SELECT ON
  public."User",
  public."Account",
  public."Transaction",
  public."LedgerEntry",
  public."IdempotencyRecord",
  public."Session",
  public."AuditEvent"
TO balancevault_admin;

-- Restricted application updates.
GRANT UPDATE ("balancePaise", "status")
ON public."Account" TO balancevault_app;

GRANT UPDATE ("role", "isActive", "updatedAt")
ON public."User" TO balancevault_app;

GRANT UPDATE ("revokedAt")
ON public."Session" TO balancevault_app;

-- Restricted administrative updates.
GRANT UPDATE ("status")
ON public."Account" TO balancevault_admin;

GRANT UPDATE ("role", "isActive", "updatedAt")
ON public."User" TO balancevault_admin;

GRANT INSERT ON
  public."User",
  public."Account",
  public."AuditEvent"
TO balancevault_admin;

-- No DELETE permissions are granted to runtime roles.
