# BalanceVault AI Development Log

This is a dated summary of actual project development and verification work, not a verbatim transcript of AI conversations. Historical entries describe the Java/Spring iteration; the active application is now React/Vite with the Node.js API.

## 2026-11-06 – Project setup and database configuration

### Work
- Set up the original Spring Boot backend with PostgreSQL and Maven.
- Designed the initial User, Role, Account, AccountType, and AccountStatus entities and repositories.
- Initially placed a database password directly in configuration, then corrected the setup to read `DB_PASSWORD` from the environment.
- Investigated a Hibernate connection failure and found that the process environment did not contain the expected variable. Loading the variable in the correct terminal resolved the connection issue.

### Verification and lessons
- Maven tests reported `BUILD SUCCESS` after dependency refresh.
- Keep credentials outside source files, and check the environment of the process that actually starts the application.

## 2026-11-07 – Java transaction and idempotency implementation

### Work
- Added Java/Spring deposit, withdrawal, and transfer operations using `BigDecimal`, database transactions, and row locking.
- Added idempotency records, unique request keys, and request hashes to detect key reuse with a different payload.
- Added unit and PostgreSQL integration tests for deposits, withdrawals, transfers, duplicate requests, and ledger entries.

### Verification and lessons
- The historical log recorded five passing unit tests, then 11 and 12 passing Maven tests as integration coverage expanded.
- Tests checked balance changes and corresponding ledger entries. These results apply to the historical Java implementation and are not proof of current Node API or production behavior.

## 2026-11-08 – Transaction history debugging

### Work
- Implemented the Java `GET /api/transactions/my` history endpoint and investigated its repository query and entity relationships.
- Used Hibernate SQL logging and considered whether join behavior excluded deposits with a null source account.

### Mistakes and verification status
- The initial implicit-join diagnosis was only a hypothesis, not a confirmed root cause.
- The revised query still needed a Postman check at the time.
- An expired JWT was suspected as a cause of a `403`, but that was not confirmed.
- The history endpoint and JWT behavior were explicitly left as needing verification; this entry does not claim them complete.

## 2026-11-12 – Node API account generation and transaction safeguards

### Work and corrections
- Investigated the unsafe `crypto.randomInt` range used for 17-digit account numbers. Replaced it with rejection-sampled `randomBytes`, `BigInt` range arithmetic, and a string result so JavaScript number precision is not involved.
- Reviewed customer deposits and found the endpoint could not establish payment settlement. Disabled deposits in the service until a verified settlement provider exists; the customer form must not create money.
- An integration run exposed PostgreSQL serialization failures reported through Prisma with SQLSTATE `40001`. Added bounded retries for that database conflict alongside Prisma's serialization error code.
- A first integration attempt also exposed a missing clearing-account/test-fixture prerequisite. The test setup was corrected to provision a valid clearing account and balanced starting ledger entries rather than weakening runtime checks.

### Verification
- Backend unit tests: 13 passed.
- Backend PostgreSQL integration tests: 5 reported, 0 failed. Coverage included RBAC, account ownership, idempotency, append-only records, and concurrent withdrawals.
- Redis responded to a direct connectivity check during the final review. Database grants and deployment security were not verified against a production system.

## 2026-11-12 – Frontend blank-page correction

### Work and corrections
- The Vite entry point imported a default `App`, but `App.jsx` contained only an incomplete transaction form and did not export the application. Restored the routed React app using the existing API contracts and visual styles rather than replacing the design.
- Added readable request errors, account/transaction pages, authenticated role-specific views, and source-filtered transfer destinations. Kept deposit submission disabled.
- An API smoke test from `127.0.0.1:5173` did not match the backend's configured `http://localhost:5173` CORS origin. Repeated the harmless invalid-login check using `localhost`; the API returned the expected invalid-credentials response. No test account or financial record was created.

### Verification
- Frontend production build passed; frontend tests: 1 passed.
- Direct refresh of `/register` rendered the registration page.
- Authenticated account creation and successful customer transactions were not exercised end to end.

## 2026-11-12 – Documentation and deployment-readiness review

### Work and corrections
- Replaced the stale Java-only project overview with the active React/Vite and Node/Prisma architecture while retaining the Java `Backend/` tree.
- Reviewed environment variable names without printing values, confirmed local Redis connectivity, and checked that configured database/secret values did not appear in the built frontend assets.
- Found that the backend Docker runtime stage omits `scripts/`, so it cannot run the repository's migration, permission, or bootstrap scripts as packaged. Documented a separate protected release job as the deployment path.
- The local API process was not running during the final health/readiness probe, so no live health response or deployed URL is claimed. Production database permissions, CORS, secrets handling, and deployment security still require separate verification.



\### 4. Debugging

\- Used AI to investigate the Hibernate database connection error.

\- Identified that the environment variable was not loaded in the current terminal.

\- Loaded the variable safely and verified the database connection.



\### 5. Testing

\- Ran Maven tests to verify the Spring Boot application.

\- Refreshed Maven dependencies after resolving IDE errors.

\- Confirmed `BUILD SUCCESS`.



\## Mistakes and Lessons Learned

\- Database credentials should not be hardcoded in application properties.

\- Environment variables must be available to the process running the application.

\- IDE dependency errors should be checked separately from Maven build results.

\- Always verify changes by running automated tests.

## Date: 2026-11-07

### 1. Transaction Management
- Implemented deposit, withdrawal and transfer operations.
- Used BigDecimal for monetary calculations.
- Added database row locking to protect concurrent account updates.
- Used database transactions to keep balance and ledger changes consistent.

### 2. Idempotency
- Created an IdempotencyRecord entity to store unique request keys.
- Added a repository to retrieve and check idempotency records.
- Used a request hash to help detect reuse of a key with different request data.

### 3. Testing
- Ran Maven tests after implementing the transaction and idempotency components.
- Confirmed BUILD SUCCESS.

### 4. Unit Testing
- Added unit tests for successful deposits and invalid amounts.
- Tested duplicate request handling.
- Tested rejection of idempotency keys reused with different request data.
- All 5 unit tests passed successfully.

### 5. PostgreSQL Integration Testing
- Used AI to create a database integration test for the deposit operation.
- Tested the deposit using the separate PostgreSQL test database.
- Verified that the account balance changed from 100.00 to 150.00.
- Verified that a CREDIT ledger entry was created.
- Ran the complete Maven test suite.
- All 11 tests passed with BUILD SUCCESS.

### 6. Transaction Integration Testing
- Added PostgreSQL integration tests for withdrawals and transfers.
- Verified withdrawal balance updates and DEBIT ledger entries.
- Verified sender and receiver balances after transfers.
- Verified that transfers create matching DEBIT and CREDIT ledger entries.
- Ran all Maven tests successfully.
- All 12 tests passed with zero failures or errors.


## 2026-11-08 – Authentication, Account APIs and Transaction History

### 1. Authentication and Security

- Implemented user registration and login APIs.
- Added BCrypt password hashing.
- Implemented JWT-based authentication using Spring Security.
- Added a JWT authentication filter to validate bearer tokens.
- Configured stateless session management.
- Loaded database passwords and JWT secrets through environment variables instead of hardcoding credentials.
- Disabled unnecessary Hibernate SQL bind TRACE logging.

### 2. Account Management APIs

- Implemented account creation for authenticated customers.
- Added GET `/api/accounts/my` to retrieve the logged-in customer's accounts.
- Verified successful account creation through Postman.
- Verified that account details and balances are returned for the authenticated customer.

### 3. Transaction History API

- Implemented GET `/api/transactions/my`.
- Connected TransactionController, TransactionService and TransactionRepository.
- Updated the JPQL query to use explicit LEFT JOIN associations.
- Verified that deposit transactions with a null source account appear in the customer's transaction history.
- Confirmed that the transaction history belongs to the authenticated customer.

### 4. Transaction Verification

- Registered a test customer and successfully logged in.
- Created a savings account.
- Deposited ₹1,000 successfully.
- Withdrew ₹300 successfully.
- Verified the remaining account balance was ₹700.
- Attempted a ₹1,000 withdrawal with only ₹700 available.
- The withdrawal was rejected due to insufficient balance.
- Verified that the account balance remained ₹700 after the rejected withdrawal.

### 5. Automated Testing

- Updated transaction service and integration tests.
- Configured the test environment to use a separate PostgreSQL test database.
- Replaced the hardcoded test JWT secret with an environment variable.
- Ran the complete Maven test suite.
- All 14 tests passed with zero failures and zero errors.

### 6. Git and Version Control

- Committed the backend authentication, account and transaction API changes.
- Pushed the changes to the GitHub main branch.
- Verified that the local working tree was clean and synchronized with the remote repository.

### AI Assistance

Used ChatGPT to:

- Review Spring Security and JWT authentication implementation.
- Debug registration, login and transaction history API issues.
- Review repository queries and entity relationships.
- Improve application configuration and environment variable handling.
- Review test coverage and identify additional security test cases.

### Mistakes / What AI Got Wrong

- Initially suspected that the transaction history issue was caused by implicit INNER JOIN behavior. The LEFT JOIN query was updated and the endpoint was subsequently verified through Postman.
- Initially suspected that a 403 response was caused by JWT expiration. Further investigation showed that an old username was being reused during duplicate registration.
- An insufficient-balance withdrawal initially produced an unhandled server exception. A clean client-facing error response still needs to be implemented.

### Current Status

- Registration and login APIs: Verified.
- JWT authentication: Verified.
- Account creation and retrieval: Verified.
- Deposit and withdrawal: Verified.
- Transaction history: Verified.
- Insufficient balance protection: Verified.
- Automated tests: 14 passed.
- Duplicate idempotency, concurrent withdrawal and account isolation tests: Further verification pending.

### Learning

Learned how JWT filters authenticate requests, how Spring Security obtains user authorities, how LEFT JOIN supports deposit history queries, how environment variables protect application secrets, and how to verify money integrity using PostgreSQL integration tests. work in JPQL, how to inspect Hibernate SQL logs, and how JWT authentication is processed through Spring Security filters.



## November 9, 2026 – Role-Based Authorization and Security Verification

### Work completed
- Reviewed User entity, Role enum, AuthService, AuthController, JwtAuthenticationFilter and SecurityConfig.
- Verified public registration always assigns CUSTOMER role.
- Added CUSTOMER-only authorization to AccountController.
- Added CUSTOMER-only authorization to TransactionController.
- Verified CUSTOMER account access: 200 OK.
- Verified AUDITOR account access: 403 Forbidden.
- Verified AUDITOR transaction history access: 403 Forbidden.
- Verified ADMIN-only endpoint: 200 OK.
- Verified ADMIN cannot access customer account endpoint: 403 Forbidden.
- Ran Maven tests: 14 passed, 0 failures, 0 errors.

### AI assistance and verification
- Used AI assistance to review Spring Security and implement role restrictions.
- Manually tested role-based authorization using Postman.
- Existing automated tests passed after the changes.

### Remaining work
- Cross-customer access testing.
- Transfer and duplicate-transfer verification.
- Concurrent withdrawal verification.
- Ledger entry verification.
- Invalid and expired JWT testing.
- Database constraints and Java 21 compatibility review.

### Verification
- Frontend build and unit test passed; backend unit and integration test commands passed as reported above.
- Git status was inspected; no files were staged, committed, pushed, or deployed during this work.
