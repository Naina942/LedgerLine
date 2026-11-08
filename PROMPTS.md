\# AI Usage Log



\## Date: 2026-11-06



\### 1. Project Setup

\- Used AI to configure a Spring Boot backend with PostgreSQL.

\- Set up the Maven project and required dependencies.



\### 2. Entity Design

\- Used AI guidance to design User, Role, Account, AccountType and AccountStatus entities.

\- Created JPA repositories for database operations.



\### 3. Database Configuration

\- Initially configured the database password directly.

\- Corrected this by using the `DB\_PASSWORD` environment variable.



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
