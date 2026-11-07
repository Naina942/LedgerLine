
package com.ledgerline.ledgerline;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.ledgerline.ledgerline.entity.Account;
import com.ledgerline.ledgerline.entity.AccountStatus;
import com.ledgerline.ledgerline.entity.AccountType;
import com.ledgerline.ledgerline.entity.LedgerEntry;
import com.ledgerline.ledgerline.entity.LedgerEntryType;
import com.ledgerline.ledgerline.entity.Role;
import com.ledgerline.ledgerline.entity.Transaction;
import com.ledgerline.ledgerline.entity.User;
import com.ledgerline.ledgerline.repository.AccountRepository;
import com.ledgerline.ledgerline.repository.LedgerEntryRepository;
import com.ledgerline.ledgerline.repository.UserRepository;
import com.ledgerline.ledgerline.service.TransactionService;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TransactionIntegrationTest {

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @Test
    void depositShouldUpdateDatabaseAndCreateLedgerEntry() {

        // Create a test user
        User user = new User();
        user.setUsername("integration_user");
        user.setEmail("integration@example.com");
        user.setPassword("test-password");
        user.setRole(Role.CUSTOMER);

        user = userRepository.save(user);

        // Create a test account
        Account account = new Account();
        account.setAccountNumber("INT10001");
        account.setOwner(user);
        account.setAccountType(AccountType.SAVINGS);
        account.setBalance(new BigDecimal("100.00"));
        account.setCurrency("INR");
        account.setStatus(AccountStatus.ACTIVE);

        account = accountRepository.save(account);

        // Perform a real database deposit
        Transaction transaction = transactionService.deposit(
                account.getAccountNumber(),
                new BigDecimal("50.00"),
                "integration-deposit-001"
        );

        // Verify transaction was created
        assertNotNull(transaction.getId());

        // Verify updated account balance in database
        Account updatedAccount = accountRepository
                .findByAccountNumber(account.getAccountNumber())
                .orElseThrow();

        assertEquals(
                new BigDecimal("150.00"),
                updatedAccount.getBalance()
        );

        // Verify ledger entry was created
        List<LedgerEntry> entries =
                ledgerEntryRepository.findByAccountId(account.getId());

        assertEquals(1, entries.size());
        assertEquals(LedgerEntryType.CREDIT, entries.get(0).getEntryType());
        assertEquals(
                new BigDecimal("50.00"),
                entries.get(0).getAmount()
        );
    }
    @Test
void withdrawalShouldUpdateDatabaseAndCreateLedgerEntry() {

    // Create a test user
    User user = new User();
    user.setUsername("withdrawal_user");
    user.setEmail("withdrawal@example.com");
    user.setPassword("test-password");
    user.setRole(Role.CUSTOMER);

    user = userRepository.save(user);

    // Create a test account
    Account account = new Account();
    account.setAccountNumber("INT10002");
    account.setOwner(user);
    account.setAccountType(AccountType.SAVINGS);
    account.setBalance(new BigDecimal("200.00"));
    account.setCurrency("INR");
    account.setStatus(AccountStatus.ACTIVE);

    account = accountRepository.save(account);

    // Perform withdrawal
    Transaction transaction = transactionService.withdraw(
            account.getAccountNumber(),
            new BigDecimal("50.00"),
            "integration-withdrawal-001"
    );

    assertNotNull(transaction.getId());

    // Verify updated balance
    Account updatedAccount = accountRepository
            .findByAccountNumber(account.getAccountNumber())
            .orElseThrow();

    assertEquals(
            new BigDecimal("150.00"),
            updatedAccount.getBalance()
    );

    // Verify debit ledger entry
    List<LedgerEntry> entries =
            ledgerEntryRepository.findByAccountId(account.getId());

    assertEquals(1, entries.size());
    assertEquals(LedgerEntryType.DEBIT, entries.get(0).getEntryType());
    assertEquals(
            new BigDecimal("50.00"),
            entries.get(0).getAmount()
    );
}
  @Test
void transferShouldUpdateBothAccountsAndCreateTwoLedgerEntries() {

    // Create test user
    User user = new User();
    user.setUsername("transfer_user");
    user.setEmail("transfer@example.com");
    user.setPassword("test-password");
    user.setRole(Role.CUSTOMER);

    user = userRepository.save(user);

    // Create sender account
    Account sender = new Account();
    sender.setAccountNumber("INT10003");
    sender.setOwner(user);
    sender.setAccountType(AccountType.SAVINGS);
    sender.setBalance(new BigDecimal("500.00"));
    sender.setCurrency("INR");
    sender.setStatus(AccountStatus.ACTIVE);

    sender = accountRepository.save(sender);

    // Create receiver account
    Account receiver = new Account();
    receiver.setAccountNumber("INT10004");
    receiver.setOwner(user);
    receiver.setAccountType(AccountType.SAVINGS);
    receiver.setBalance(new BigDecimal("100.00"));
    receiver.setCurrency("INR");
    receiver.setStatus(AccountStatus.ACTIVE);

    receiver = accountRepository.save(receiver);

    // Perform transfer
    Transaction transaction = transactionService.transfer(
            sender.getAccountNumber(),
            receiver.getAccountNumber(),
            new BigDecimal("200.00"),
            "integration-transfer-001"
    );

    assertNotNull(transaction.getId());

    // Verify sender balance
    Account updatedSender = accountRepository
            .findByAccountNumber(sender.getAccountNumber())
            .orElseThrow();

    assertEquals(
            new BigDecimal("300.00"),
            updatedSender.getBalance()
    );

    // Verify receiver balance
    Account updatedReceiver = accountRepository
            .findByAccountNumber(receiver.getAccountNumber())
            .orElseThrow();

    assertEquals(
            new BigDecimal("300.00"),
            updatedReceiver.getBalance()
    );

    // Verify both ledger entries
    List<LedgerEntry> senderEntries =
            ledgerEntryRepository.findByAccountId(sender.getId());

    List<LedgerEntry> receiverEntries =
            ledgerEntryRepository.findByAccountId(receiver.getId());

    assertEquals(1, senderEntries.size());
    assertEquals(1, receiverEntries.size());

    assertEquals(
            LedgerEntryType.DEBIT,
            senderEntries.get(0).getEntryType()
    );

    assertEquals(
            LedgerEntryType.CREDIT,
            receiverEntries.get(0).getEntryType()
    );

    assertEquals(
            new BigDecimal("200.00"),
            senderEntries.get(0).getAmount()
    );

    assertEquals(
            new BigDecimal("200.00"),
            receiverEntries.get(0).getAmount()
    );
}
}
