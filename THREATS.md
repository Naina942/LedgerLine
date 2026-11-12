\# LedgerLine – Security Threats and Mitigations



\## 1. Unauthorized Account Access

\*\*Threat:\*\* A user may try to access another user's bank account.



\*\*Mitigation:\*\* Verify account ownership on the backend before allowing account operations.



\*\*Status:\*\* Planned



\## 2. Password Exposure

\*\*Threat:\*\* Storing passwords as plain text can expose user credentials.



\*\*Mitigation:\*\* Hash passwords using BCrypt before storing them in the database.



\*\*Status:\*\* Planned



\## 3. Negative Account Balance

\*\*Threat:\*\* Withdrawals may result in an account having a negative balance.



\*\*Mitigation:\*\* Validate available balance before processing withdrawals and use database transactions.



\*\*Status:\*\* Planned



\## 4. Duplicate Transactions

\*\*Threat:\*\* Repeated API requests may process the same transaction more than once.



\*\*Mitigation:\*\* Use unique idempotency keys to prevent duplicate processing.



\*\*Status:\*\* Planned



\## 5. Concurrent Withdrawals

\*\*Threat:\*\* Simultaneous withdrawals may cause incorrect account balances.



\*\*Mitigation:\*\* Use database row-level locking and transactional balance updates.



\*\*Status:\*\* Planned



\## 6. Sensitive Credential Exposure

\*\*Threat:\*\* Database passwords or secrets may accidentally be committed to GitHub.



\*\*Mitigation:\*\* Use environment variables and exclude secret files through `.gitignore`.



\*\*Status:\*\* Environment variable configuration implemented; Git verification pending.



\## Security Development Note

The mitigations marked as Planned are design requirements and must be implemented and tested before the application is considered secure.

## Day 2 Security Updates

### Implemented
- Added database row-level pessimistic locking for account updates.
- Added idempotency keys with unique database constraints.
- Added request hashing to detect reuse of an idempotency key with different request data.
- Used transactional service methods for deposits, withdrawals and transfers.

### Testing Status
- Five unit tests passed successfully.
- Concurrent duplicate-request handling and database-level concurrency tests are still pending.
- Account ownership authorization is still pending.


## 2026-11-08 – Transaction History and Authentication Risks
## Day 3

### Threat: Unauthorized Transaction History Access
**Risk:** A customer may attempt to access another customer's transaction history.

**Mitigation:**
- Require authentication for transaction history endpoints.
- Derive the username from the authenticated security context.
- Filter transactions using source and destination account ownership.
- Never accept a customer username from an untrusted request parameter.

**Verification:** Transaction history query and authentication behavior are under testing.

### Threat: Missing Transaction History Records
**Risk:** Transactions with a NULL source account, such as deposits, may be excluded by incorrect database joins.

**Mitigation:**
- Use explicit LEFT JOIN associations for source and destination accounts and their owners.
- Verify transaction history against persisted PostgreSQL records.
- Test deposits, withdrawals and transfers separately.

### Threat: Expired or Invalid JWT
**Risk:** Expired or invalid tokens may result in failed authentication or unauthorized access attempts.

**Mitigation:**
- Validate JWT signatures and expiration.
- Reject invalid or expired tokens.
- Require valid authentication for protected endpoints.
- Test token expiration and invalid-token scenarios.


## November 9, 2026 – Security Verification Update

| Threat | Current status |
|---|---|
| Public user assigning ADMIN/AUDITOR role | Mitigated – registration assigns CUSTOMER |
| Unauthorized account access by AUDITOR | Tested – 403 Forbidden |
| Unauthorized transaction history access by AUDITOR | Tested – 403 Forbidden |
| ADMIN accessing customer account APIs | Tested – 403 Forbidden |
| CUSTOMER accessing own account API | Tested – 200 OK |
| ADMIN accessing admin-only endpoint | Tested – 200 OK |
| Duplicate transaction requests | Idempotency implemented; further transfer verification pending |
| Concurrent withdrawals | Pessimistic locking implemented; concurrent verification pending |
| Cross-customer account access | Testing pending |
| Invalid or expired JWT | Testing pending |
| Negative account balance | Service validation implemented; database constraint review pending |

### Automated test results
- Maven tests: 14 passed.
- Failures: 0.
- Errors: 0.

# BalanceVault – Threats, Mitigations, and Residual Risks

This document records code/test evidence from the local project review. It is not a penetration test or a production security certification. Database roles and deployment controls must be verified separately in the actual production environment.

## Threat review

| Threat | Implemented mitigation and evidence | Residual risk / status |
|---|---|---|
| Unverified deposits create customer funds | Deposit service rejects every customer deposit with `503 DEPOSITS_UNAVAILABLE`; unit and integration tests verify rejection. No customer form may credit funds without verified settlement. | **Open deployment blocker.** No payment settlement provider, signed callback verification, reconciliation, or settlement operations are configured. Keep deposits disabled. |
| Password theft and forged/replayed tokens | bcrypt password hashing; JWT verification restricts algorithm, issuer, and audience; 15-minute token lifetime; database-backed sessions support revocation and active-user checks. Authentication tests cover session rejection. | Production secret strength, rotation, storage, HTTPS, and incident response have not been independently checked. |
| Unauthorized account/transaction access or privilege escalation | Route-level role checks, account ownership filtering, role-specific response fields, no public caller-selected role, and bootstrap-only ADMIN creation. Integration tests exercise customer isolation, auditor read-only access, and bootstrap behavior. | Automated tests do not prove every possible authorization path. Review any future endpoint before exposure and test it with each role. |
| Money creation/loss or unbalanced ledger entries | Monetary values use integer paise/`BigInt`; request values are validated; transactions update balances and ledger entries atomically. PostgreSQL checks/triggers require two matching debit/credit entries and account balances to match immutable ledger history. | The schema and SQL were inspected and local integration tests passed. Actual production constraints, triggers, owners, and roles remain unverified. Privileged database owners can change protections. |
| Overdrafts, race conditions, duplicate financial operations | Nonnegative customer balance constraint; sorted account row locks; serializable transactions; bounded serialization retry; unique user/idempotency-key constraint with request hash. Integration tests exercise concurrent withdrawals, idempotency, and rollback behavior. | Production database isolation/connection settings and operational retries must be validated. Clients must preserve the same idempotency key on retry. |
| Mutation/deletion of posted transactions, ledger, or audits | SQL triggers reject update/delete on transaction, ledger, and audit records; runtime SQL roles have no delete grants in the supplied permissions script. Integration tests cover append-only behavior. | Production grants and trigger installation were not checked. Protect migrations, DBA credentials, backups, and audit access. |
| Redis outage bypasses throttling | Redis rate limiter returns a service-unavailable failure rather than accepting requests without protection; unit tests verify fail-closed behavior. Redis responded to a direct ping during this review. | Availability was checked only from this local environment. Configure protected managed Redis, TLS/credentials, alerts, and correct proxy/IP handling in production. |
| Unauthorized first-admin creation | Public registration assigns only `CUSTOMER`; admin bootstrap uses a transaction/advisory lock, refuses when an administrator already exists, and uses the restricted admin connection. | Secure bootstrap credentials and access to `ADMIN_DATABASE_URL`; execute once through a controlled operator workflow. |
| API abuse, injection, or error detail leakage | Zod validation uses strict object shapes; Prisma parameterizes queries; request bodies are size-limited; Helmet is enabled; CORS uses one configured origin; API errors return generic messages for unexpected failures. | Error logs may contain exception details and need access control/redaction. Production TLS, exact CORS origin, proxy trust, request logging, and alerting remain to be verified. |
| Frontend secret leakage and browser attacks | Frontend API URL is public configuration; configured backend secret/connection values were checked against generated build assets and none were present. Existing Nginx config provides SPA fallback and basic security headers. | Bearer token is held in `sessionStorage` and is accessible to same-origin script; prevent XSS, consider a reviewed CSP, and verify host security headers. Never place secrets in `VITE_` variables. |
| Sensitive auditor/admin data exposure | Auditor routes are read-only and omit selected administrator fields; transaction listings reduce auditor details. Integration tests cover auditor read-only behavior. | Review production data classification and audit metadata before real records are used; least-privilege access and retention policy are not certified. |

## Verified locally in this review

- Frontend production build succeeded and its unit test passed.
- Backend unit tests passed (13 tests); PostgreSQL integration tests passed (5 tests reported).
- Redis connectivity succeeded.
- The integration runner confirmed its configured URLs satisfy the dedicated test-database name guard.
- The production frontend bundle did not contain the configured backend database, Redis, bootstrap-password, or JWT-secret values.
- API source configuration uses the configured frontend origin and the API defines `/health` and dependency-checking `/ready` endpoints.

## Not verified / production assumptions

- The local API was not running when `/health` and `/ready` were probed; no live endpoint response is claimed. No deployed frontend/backend URLs were tested.
- Production PostgreSQL permissions, role ownership, migrations, triggers, backups, restore procedures, and administrative access must be verified separately.
- Production CORS, TLS, proxy hop configuration, Redis security/availability, secret rotation, logging/monitoring, and incident response have not been tested.
- The backend Docker runtime stage omits `scripts/`, so it cannot run the repository's migration, permission, or bootstrap scripts as packaged. Use a separate protected release job built from the source or revise/validate the deployment image before relying on in-container migration commands.
- No payment integration or verified settlement provider is configured. Deposits must remain disabled.
- Automated tests cover selected workflows, not exhaustive adversarial testing or a formal audit.

## Release checklist

- [x] Customer deposits are rejected until settlement verification exists.
- [x] Account and transaction ownership checks are implemented and covered by integration tests.
- [x] Local unit and integration suites pass.
- [ ] Verify actual production grants, schema triggers, and migration execution using the production DBA workflow.
- [ ] Set and test exact HTTPS frontend CORS origin, proxy trust, secrets, and managed Redis configuration.
- [ ] Ensure a protected release job can run role provisioning/migrations/grants/bootstrap; the current runtime Docker image omits these scripts.
- [ ] Test live `/health` and `/ready`, authentication, authorization, SPA refresh, and monitoring after deployment.
- [ ] Keep deposits disabled unless a verified payment settlement and reconciliation flow is implemented and independently tested.
