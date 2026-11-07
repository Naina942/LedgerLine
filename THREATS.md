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