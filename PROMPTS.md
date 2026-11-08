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


## 2026-11-08 – Transaction History API Debugging

### Work completed
- Implemented the GET `/api/transactions/my` endpoint.
- Connected TransactionController, TransactionService and TransactionRepository.
- Verified Transaction, Account and User entity relationships.
- Inspected PostgreSQL transaction records and confirmed successful deposit persistence.
- Verified that the deposited transaction belongs to the correct customer account.
- Enabled Hibernate SQL logging to investigate the empty transaction history response.
- Updated the JPQL query to use explicit LEFT JOIN associations.

### AI assistance
Used ChatGPT to:
- Review entity mappings and repository queries.
- Understand Hibernate-generated SQL joins.
- Investigate why deposit transactions were missing from transaction history.
- Review JWT authentication and Spring Security configuration.

### Mistakes / What AI got wrong
- The initial diagnosis attributed the empty history response to implicit INNER JOIN behavior. This was a possible explanation, not a confirmed root cause.
- The updated JPQL query still needs to be verified through Postman.
- The 403 response was suspected to be caused by an expired JWT token, but this has not yet been confirmed.

### Current status
- Deposit persistence: Verified.
- Account ownership mapping: Verified.
- Transaction history endpoint: Implemented, verification pending.
- JWT authentication: Under investigation.

### Learning
Learned how LEFT JOIN associations work in JPQL, how to inspect Hibernate SQL logs, and how JWT authentication is processed through Spring Security filters.
