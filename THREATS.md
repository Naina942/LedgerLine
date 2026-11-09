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
