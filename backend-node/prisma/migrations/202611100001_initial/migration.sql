CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'AUDITOR');
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CURRENT', 'SYSTEM');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER');
CREATE TYPE "TransactionStatus" AS ENUM ('POSTED');
CREATE TYPE "LedgerSide" AS ENUM ('DEBIT', 'CREDIT');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" VARCHAR(50) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "passwordHash" VARCHAR(100) NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_username_key" UNIQUE ("username"),
  CONSTRAINT "User_email_key" UNIQUE ("email")
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "accountNumber" VARCHAR(24) NOT NULL,
  "ownerId" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "accountType" "AccountType" NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "balancePaise" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_accountNumber_key" UNIQUE ("accountNumber"),
  CONSTRAINT "Account_balance_nonnegative" CHECK ("isSystem" OR "balancePaise" >= 0),
  CONSTRAINT "Account_owner_kind_check" CHECK (
    ("isSystem" AND "ownerId" IS NULL AND "accountType" = 'SYSTEM')
    OR (NOT "isSystem" AND "ownerId" IS NOT NULL AND "accountType" IN ('SAVINGS', 'CURRENT'))
  )
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
  "amountPaise" BIGINT NOT NULL,
  "sourceAccountId" TEXT,
  "destinationAccountId" TEXT,
  "requestedById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Transaction_amount_positive" CHECK ("amountPaise" > 0),
  CONSTRAINT "Transaction_accounts_check" CHECK (
    ("type" = 'DEPOSIT' AND "sourceAccountId" IS NULL AND "destinationAccountId" IS NOT NULL)
    OR ("type" = 'WITHDRAWAL' AND "sourceAccountId" IS NOT NULL AND "destinationAccountId" IS NULL)
    OR ("type" = 'TRANSFER' AND "sourceAccountId" IS NOT NULL AND "destinationAccountId" IS NOT NULL AND "sourceAccountId" <> "destinationAccountId")
  )
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "side" "LedgerSide" NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amountPaise" > 0)
);

CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "transactionId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdempotencyRecord_userId_key_key" UNIQUE ("userId", "key")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenId" VARCHAR(64) NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_tokenId_key" UNIQUE ("tokenId")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" VARCHAR(80) NOT NULL,
  "subjectId" VARCHAR(100),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "Account_ownerId_status_idx" ON "Account"("ownerId", "status");
CREATE INDEX "Account_isSystem_currency_idx" ON "Account"("isSystem", "currency");
CREATE INDEX "Transaction_requestedById_createdAt_idx" ON "Transaction"("requestedById", "createdAt" DESC);
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt" DESC);
CREATE INDEX "Transaction_sourceAccountId_createdAt_idx" ON "Transaction"("sourceAccountId", "createdAt" DESC);
CREATE INDEX "Transaction_destinationAccountId_createdAt_idx" ON "Transaction"("destinationAccountId", "createdAt" DESC);
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt" DESC);
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");
CREATE INDEX "IdempotencyRecord_transactionId_idx" ON "IdempotencyRecord"("transactionId");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt" DESC);
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt" DESC);
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt" DESC);

ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceAccountId_fkey"
  FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_destinationAccountId_fkey"
  FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_financial_record_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'posted financial records are append-only';
END;
$$;

CREATE TRIGGER "LedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
CREATE TRIGGER "Transaction_append_only"
  BEFORE UPDATE OR DELETE ON "Transaction"
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();

CREATE FUNCTION prevent_untrusted_admin_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."role" = 'ADMIN'
     AND current_user <> 'balancevault_admin'
     AND (TG_OP = 'INSERT' OR OLD."role" <> 'ADMIN') THEN
    RAISE EXCEPTION 'administrator roles require the trusted bootstrap database role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "User_admin_role_protection"
  BEFORE INSERT OR UPDATE OF "role" ON "User"
  FOR EACH ROW EXECUTE FUNCTION prevent_untrusted_admin_assignment();

CREATE FUNCTION enforce_balanced_ledger_transaction() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  entry_count BIGINT;
  debit_total NUMERIC;
  credit_total NUMERIC;
  transaction_type "TransactionType";
  transaction_amount BIGINT;
  source_id TEXT;
  destination_id TEXT;
  transaction_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Transaction' THEN
    transaction_id := NEW."id";
  ELSE
    transaction_id := NEW."transactionId";
  END IF;

  SELECT "type", "amountPaise", "sourceAccountId", "destinationAccountId"
    INTO transaction_type, transaction_amount, source_id, destination_id
    FROM "Transaction"
   WHERE "id" = transaction_id;

  SELECT COUNT(*),
         COALESCE(SUM("amountPaise") FILTER (WHERE "side" = 'DEBIT'), 0),
         COALESCE(SUM("amountPaise") FILTER (WHERE "side" = 'CREDIT'), 0)
    INTO entry_count, debit_total, credit_total
    FROM "LedgerEntry"
   WHERE "transactionId" = transaction_id;

  IF entry_count <> 2 OR debit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'each posted transaction must have exactly two equal debit and credit entries';
  END IF;
  IF debit_total <> transaction_amount
     OR (transaction_type = 'DEPOSIT' AND (
       NOT EXISTS (SELECT 1 FROM "LedgerEntry" le JOIN "Account" a ON a."id" = le."accountId"
                    WHERE le."transactionId" = transaction_id AND le."side" = 'DEBIT'
                      AND a."isSystem" AND le."amountPaise" = transaction_amount)
       OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" le
                      WHERE le."transactionId" = transaction_id AND le."side" = 'CREDIT'
                        AND le."accountId" = destination_id AND le."amountPaise" = transaction_amount)
     ))
     OR (transaction_type = 'WITHDRAWAL' AND (
       NOT EXISTS (SELECT 1 FROM "LedgerEntry" le
                    WHERE le."transactionId" = transaction_id AND le."side" = 'DEBIT'
                      AND le."accountId" = source_id AND le."amountPaise" = transaction_amount)
       OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" le JOIN "Account" a ON a."id" = le."accountId"
                      WHERE le."transactionId" = transaction_id AND le."side" = 'CREDIT'
                        AND a."isSystem" AND le."amountPaise" = transaction_amount)
     ))
     OR (transaction_type = 'TRANSFER' AND (
       NOT EXISTS (SELECT 1 FROM "LedgerEntry" le
                    WHERE le."transactionId" = transaction_id AND le."side" = 'DEBIT'
                      AND le."accountId" = source_id AND le."amountPaise" = transaction_amount)
       OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" le
                      WHERE le."transactionId" = transaction_id AND le."side" = 'CREDIT'
                        AND le."accountId" = destination_id AND le."amountPaise" = transaction_amount)
     )) THEN
    RAISE EXCEPTION 'ledger entries do not match the transaction accounts and amount';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "LedgerEntry_balanced_transaction"
  AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction();
CREATE CONSTRAINT TRIGGER "Transaction_has_balanced_ledger"
  AFTER INSERT ON "Transaction"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction();

CREATE FUNCTION enforce_account_balance_matches_ledger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  account_id TEXT;
  account_balance BIGINT;
  ledger_balance NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'Account' THEN
    account_id := NEW."id";
  ELSE
    account_id := NEW."accountId";
  END IF;
  SELECT "balancePaise" INTO account_balance FROM "Account" WHERE "id" = account_id;
  SELECT COALESCE(SUM(CASE WHEN "side" = 'CREDIT' THEN "amountPaise" ELSE -"amountPaise" END), 0)
    INTO ledger_balance
    FROM "LedgerEntry" WHERE "accountId" = account_id;
  IF account_balance IS DISTINCT FROM ledger_balance THEN
    RAISE EXCEPTION 'account balance does not match its immutable ledger history';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Account_balance_ledger_consistency"
  AFTER INSERT OR UPDATE OF "balancePaise" ON "Account"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_account_balance_matches_ledger();
CREATE CONSTRAINT TRIGGER "LedgerEntry_account_balance_consistency"
  AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_account_balance_matches_ledger();
