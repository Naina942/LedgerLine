
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

        User user = new User();
        user.setUsername("integration_user");
        user.setEmail("integration@example.com");
        user.setPassword("test-password");
        user.setRole(Role.CUSTOMER);

        user = userRepository.save(user);

        Account account = new Account();
        account.setAccountNumber("INT10001");
        account.setOwner(user);
        account.setAccountType(AccountType.SAVINGS);
        account.setBalance(new BigDecimal("100.00"));
        account.setCurrency("INR");
        account.setStatus(AccountStatus.ACTIVE);

        account = accountRepository.save(account);

        Transaction transaction = transactionService.deposit(
                account.getAccountNumber(),
                new BigDecimal("50.00"),
                "integration-deposit-001",
                "integration_user"
        );

        assertNotNull(transaction.getId());

        Account updatedAccount = accountRepository
                .findByAccountNumber(account.getAccountNumber())
                .orElseThrow();

        assertEquals(
                new BigDecimal("150.00"),
                updatedAccount.getBalance()
        );

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

        User user = new User();
        user.setUsername("withdrawal_user");
        user.setEmail("withdrawal@example.com");
        user.setPassword("test-password");
        user.setRole(Role.CUSTOMER);

        user = userRepository.save(user);

        Account account = new Account();
        account.setAccountNumber("INT10002");
        account.setOwner(user);
        account.setAccountType(AccountType.SAVINGS);
        account.setBalance(new BigDecimal("200.00"));
        account.setCurrency("INR");
        account.setStatus(AccountStatus.ACTIVE);

        account = accountRepository.save(account);

        Transaction transaction = transactionService.withdraw(
                account.getAccountNumber(),
                new BigDecimal("50.00"),
                "integration-withdrawal-001",
                "withdrawal_user"
        );

        assertNotNull(transaction.getId());

        Account updatedAccount = accountRepository
                .findByAccountNumber(account.getAccountNumber())
                .orElseThrow();

        assertEquals(
                new BigDecimal("150.00"),
                updatedAccount.getBalance()
        );

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

        User user = new User();
        user.setUsername("transfer_user");
        user.setEmail("transfer@example.com");
        user.setPassword("test-password");
        user.setRole(Role.CUSTOMER);

        user = userRepository.save(user);

        Account sender = new Account();
        sender.setAccountNumber("INT10003");
        sender.setOwner(user);
        sender.setAccountType(AccountType.SAVINGS);
        sender.setBalance(new BigDecimal("500.00"));
        sender.setCurrency("INR");
        sender.setStatus(AccountStatus.ACTIVE);

        sender = accountRepository.save(sender);

        Account receiver = new Account();
        receiver.setAccountNumber("INT10004");
        receiver.setOwner(user);
        receiver.setAccountType(AccountType.SAVINGS);
        receiver.setBalance(new BigDecimal("100.00"));
        receiver.setCurrency("INR");
        receiver.setStatus(AccountStatus.ACTIVE);

        receiver = accountRepository.save(receiver);

        Transaction transaction = transactionService.transfer(
                sender.getAccountNumber(),
                receiver.getAccountNumber(),
                new BigDecimal("200.00"),
                "integration-transfer-001",
                "transfer_user"
        );

        assertNotNull(transaction.getId());

        Account updatedSender = accountRepository
                .findByAccountNumber(sender.getAccountNumber())
                .orElseThrow();

        assertEquals(
                new BigDecimal("300.00"),
                updatedSender.getBalance()
        );

        Account updatedReceiver = accountRepository
                .findByAccountNumber(receiver.getAccountNumber())
                .orElseThrow();

        assertEquals(
                new BigDecimal("300.00"),
                updatedReceiver.getBalance()
        );

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
