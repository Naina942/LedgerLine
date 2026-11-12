-- Apply as the database administrator after each migration deployment.
GRANT USAGE ON SCHEMA balancevault TO balancevault_app, balancevault_admin;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA balancevault TO balancevault_app;
GRANT SELECT ON ALL TABLES IN SCHEMA balancevault TO balancevault_admin;

GRANT UPDATE ("balancePaise", "status") ON TABLE balancevault."Account" TO balancevault_app;
GRANT UPDATE ("role", "isActive", "updatedAt") ON TABLE balancevault."User" TO balancevault_app;
GRANT UPDATE ("revokedAt") ON TABLE balancevault."Session" TO balancevault_app;

GRANT UPDATE ("status") ON TABLE balancevault."Account" TO balancevault_admin;
GRANT UPDATE ("role", "isActive", "updatedAt") ON TABLE balancevault."User" TO balancevault_admin;
GRANT INSERT ON TABLE balancevault."User", balancevault."Account", balancevault."AuditEvent" TO balancevault_admin;

-- No runtime role receives DELETE privileges. Database triggers independently protect posted
-- transactions, ledger entries, and audit events from UPDATE/DELETE.
