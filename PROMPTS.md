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
