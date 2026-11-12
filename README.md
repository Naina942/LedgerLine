# BalanceVault

**Repository:** `Naina942/LedgerLine`
BalanceVault is a financial ledger and transaction-management project. It is an educational/development project, not a production banking or payment service.

## Status and security limitations

- Customer-initiated deposits are disabled and return `503 DEPOSITS_UNAVAILABLE`.
- Do not credit customer funds through an unverified deposit form. Deposits must remain disabled until a verified payment-settlement provider, signature validation, reconciliation, and operational controls are implemented and tested.
- Production database permissions, deployment security, secrets management, monitoring, and live URLs have not been independently verified. Do not claim production security or payment integration is complete.
- The Java application in `Backend/ledgerline/` is retained as a legacy/alternate implementation. The active React application and Node API are under `frontend/` and `backend-node/`; the Java service is not part of the current Compose deployment.

## Features

- Registration and sign-in with bcrypt password hashes, short-lived JWTs, revocable database sessions, and `CUSTOMER`, `ADMIN`, and `AUDITOR` roles.
- Customer account creation and ownership-scoped account and transaction access.
- Withdrawals and transfers using exact integer paise, idempotency keys, PostgreSQL transactions, account locks, and retry handling for serialization conflicts.
- Double-entry ledger records with database checks for balanced entries and balance/ledger consistency.
- Append-only transaction, ledger, and audit records enforced by database triggers.
- Redis-backed rate limiting that fails closed when Redis is unavailable.
- A React/Vite interface with dashboard, accounts, transaction history, and role-specific pages. Deposits remain disabled in the UI and backend.

These controls are implemented in code and covered to varying degrees by automated tests; that is not a substitute for an independent production security assessment.

## Architecture

- `frontend/` — React 19, Vite, React Router, and Axios. The API URL is `VITE_API_URL` or defaults to `http://localhost:4000`.
- `backend-node/` — Node.js/Express API, Prisma, PostgreSQL, Redis, authentication, validation, and role-specific routes.
- `backend-node/prisma/` — Prisma schema, SQL migration, role/grant scripts, constraints, and triggers.
- `compose.yaml` — Local PostgreSQL and Redis services bound to loopback.
- `Backend/ledgerline/` — retained Java/Spring project; it is not used by the active frontend/Node/Compose setup.

## Prerequisites

- Node.js 20 or newer and npm.
- Docker Desktop with Compose, or compatible PostgreSQL and Redis services.
- PostgreSQL 17 is used by the local Compose setup; production should use a supported managed PostgreSQL service.
- Redis 7 is used by the local Compose setup; production should use a secured managed Redis service such as Upstash.

## Local setup (Windows PowerShell)

1. Copy the example environment files only if the corresponding local files do not already exist. Edit them locally; never commit `.env` files.

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   if (-not (Test-Path backend-node\.env)) { Copy-Item .env.example backend-node\.env }
   ```

   Fill the local placeholders in both files as needed. Use strong, unique values for database-role passwords and `JWT_SECRET`. Do not reuse local values in production.

2. Start local PostgreSQL and Redis from the repository root:

   ```powershell
   docker compose up -d postgres redis
   ```

3. Provision local database roles, apply the schema, and grant the application permissions. Run these commands from `backend-node/`:

   ```powershell
   Set-Location .\backend-node
   npm ci
   npm run db:generate
   npm run db:roles
   npm run db:migrate
   npm run db:permissions
   ```

   `DATABASE_PROVISIONER_URL` is used only by the role/grant scripts, `MIGRATION_DATABASE_URL` by migrations, and `DATABASE_URL` by the runtime API. Keep the runtime account restricted. The scripts do not replace a production DBA review.

4. Bootstrap the first administrator once, using `ADMIN_DATABASE_URL`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_USERNAME`, and `ADMIN_BOOTSTRAP_PASSWORD`:

   ```powershell
   npm run admin:bootstrap
   ```

   Bootstrap is intentionally closed after an administrator exists. It also creates the INR clearing account. Never enable public registration with an `ADMIN` role.

5. Start the API:

   ```powershell
   npm run dev
   ```

6. In a second PowerShell terminal, install and start the frontend:

   ```powershell
   Set-Location 'C:\Users\user\OneDrive\Desktop\LedgerLine\frontend'
   npm ci
   npm run dev
   ```

   Open `http://localhost:5173`. The development CORS origin defaults to this exact origin. If the API is elsewhere, configure `VITE_API_URL` in a local frontend env file (for example, `.env.local`); the value is a public API URL, not a secret.

## Environment variables

Variable names only are listed here; never put their values in source control or public frontend settings unless explicitly intended to be public.

| Purpose | Names |
|---|---|
| Local Compose PostgreSQL | `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Runtime API | `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `FRONTEND_ORIGIN`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_REGISTER_MAX`, `RATE_LIMIT_TRANSACTION_MAX`, `TRUST_PROXY_HOPS` |
| Database role/migration operations | `DATABASE_PROVISIONER_URL`, `MIGRATION_DATABASE_URL`, `ADMIN_DATABASE_URL`, `BALANCEVAULT_APP_PASSWORD`, `BALANCEVAULT_MIGRATOR_PASSWORD`, `BALANCEVAULT_ADMIN_PASSWORD` |
| One-time administrator bootstrap | `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_USERNAME`, `ADMIN_BOOTSTRAP_PASSWORD` |
| Integration tests | `TEST_DATABASE_URL`, `TEST_ADMIN_DATABASE_URL` |
| Frontend build | `VITE_API_URL` |

`JWT_SECRET` must be at least 32 characters. Database role passwords must meet the provisioning script's minimum length. Integration URLs must point to the same dedicated disposable database whose name contains a distinct `test` segment; the test runner refuses other database names. Never point tests at production data.

The API requires `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` at startup. Other runtime settings have development defaults where supported; set explicit production values rather than relying on them.

## API overview

Base URL: `http://localhost:4000` in local development. Protected endpoints require `Authorization: Bearer <token>`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /health` | Public | Process health only; does not prove dependencies are ready. |
| `GET /ready` | Public | Checks PostgreSQL and Redis; returns `503` if either is unavailable. |
| `POST /api/auth/register` | Public, rate-limited | Creates a `CUSTOMER`; caller cannot choose a role. |
| `POST /api/auth/login` | Public, rate-limited | Authenticates and returns a short-lived access token. |
| `GET /api/auth/me`, `POST /api/auth/logout` | Authenticated | Read current user or revoke the current session. |
| `GET /api/accounts`, `GET /api/accounts/:accountNumber`, `POST /api/accounts` | `CUSTOMER` | List, read, and create the current user's accounts. |
| `POST /api/transactions/withdraw` | `CUSTOMER`, rate-limited | Withdraw from an owned, active account. Requires `Idempotency-Key`. |
| `POST /api/transactions/transfer` | `CUSTOMER`, rate-limited | Transfer between owned, active accounts. Requires `Idempotency-Key`. |
| `POST /api/transactions/deposit` | `CUSTOMER`, rate-limited | Deliberately unavailable until verified settlement is implemented. |
| `GET /api/transactions/my` | `CUSTOMER` | Paginated, ownership-scoped activity. |
| `GET /api/transactions` | `ADMIN`, `AUDITOR` | Paginated system transaction list; auditor response is reduced. |
| `GET /api/transactions/:transactionId` | Authenticated, role-scoped | Read a transaction the user is allowed to see. |
| `GET /api/admin/users`, `PATCH /api/admin/users/:userId` | `ADMIN` | List users and update permitted user properties. Admin elevation is reserved for bootstrap. |
| `GET /api/admin/accounts`, `PATCH /api/admin/accounts/:accountId/status` | `ADMIN` | List accounts and change status. |
| `GET /api/audit` | `ADMIN`, `AUDITOR` | Paginated audit events with role-specific fields. |

Amounts are decimal strings in INR at API boundaries and integer paise internally; paise values are serialized as strings to avoid JavaScript precision loss. Withdrawal and transfer requests use the `Idempotency-Key` header. Reuse the same key for retries of the same request; a changed payload with that key is rejected.

Common request bodies:

- `POST /api/auth/register`
  ```json
  { "username": "customer1", "email": "customer@example.com", "password": "<at-least-12-characters>" }
  ```
- `POST /api/auth/login`
  ```json
  { "login": "customer1", "password": "<password>" }
  ```
- `POST /api/accounts`
  ```json
  { "accountType": "SAVINGS" }
  ```
- `POST /api/transactions/withdraw` (deposit uses the same account/amount shape but remains disabled)
  ```json
  { "accountNumber": "<owned-account-number>", "amount": "25.50" }
  ```
- `POST /api/transactions/transfer`
  ```json
  { "fromAccountNumber": "<owned-source-account>", "toAccountNumber": "<owned-destination-account>", "amount": "10.00" }
  ```

Transaction history accepts `page`, `pageSize`, and optionally `type` as query parameters.

## Tests and builds

Run frontend commands from `frontend/`:

```powershell
npm test
npm run build
```

Run backend commands from `backend-node/`:

```powershell
npm test
npm run test:integration
```

Integration tests require the dedicated test database variables described above and will modify that disposable database. Do not run them against production.

## Deployment preparation

Recommended separation: Vercel for the static frontend, Render (or a comparable Node host) for the API, managed PostgreSQL for application data, and Upstash Redis for rate limiting.

1. Create isolated production PostgreSQL roles and provision schema/permissions with a DBA-controlled workflow. Use separate least-privilege runtime, migration, provisioner, and admin credentials. Verify the actual grants and trigger protections against the production database before launch.
2. Configure backend runtime variables from the table above. Set `NODE_ENV=production`, `FRONTEND_ORIGIN` to the exact HTTPS Vercel origin, a strong unique `JWT_SECRET`, managed `DATABASE_URL`, and secured `REDIS_URL`. Set `TRUST_PROXY_HOPS` only after verifying the host's proxy topology. Never use a wildcard CORS origin.
3. Run role provisioning as the authorized database operator, deploy Prisma migrations using `MIGRATION_DATABASE_URL`, and apply grants after migrations using `DATABASE_PROVISIONER_URL`. Bootstrap the initial administrator through the restricted `ADMIN_DATABASE_URL` path before exposing administration. Keep provisioner/admin credentials out of the API runtime. The current backend Docker runtime image does not include `scripts/`; run these commands from a separate protected release job built from the repository source, or deliberately update and validate the image before using it for release commands.
4. Set the Vercel build-time `VITE_API_URL` to the deployed HTTPS API origin. It is public client configuration; do not put credentials in any `VITE_` variable. Configure a SPA fallback/rewrite if needed and test direct route refreshes on the deployed frontend.
5. Test `GET /health` and `GET /ready`, browser CORS from the exact deployed origin, authentication/RBAC, and direct-route refreshes. Do not declare deployment complete until live URLs and dependency checks have been exercised.
6. Keep deposits disabled. A payment provider, verified settlement callbacks, reconciliation, alerting, and production security review are prerequisites to enabling any customer credit flow.

No live deployment or production security verification is claimed by this repository documentation.
