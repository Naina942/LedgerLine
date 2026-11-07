
package com.ledgerline.ledgerline;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ledgerline.ledgerline.entity.Account;
import com.ledgerline.ledgerline.entity.AccountStatus;
import com.ledgerline.ledgerline.entity.IdempotencyRecord;
import com.ledgerline.ledgerline.entity.LedgerEntry;
import com.ledgerline.ledgerline.entity.LedgerEntryType;
import com.ledgerline.ledgerline.entity.Transaction;
import com.ledgerline.ledgerline.repository.AccountRepository;
import com.ledgerline.ledgerline.repository.IdempotencyRecordRepository;
import com.ledgerline.ledgerline.repository.LedgerEntryRepository;
import com.ledgerline.ledgerline.repository.TransactionRepository;
import com.ledgerline.ledgerline.service.TransactionService;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private LedgerEntryRepository ledgerEntryRepository;

    @Mock
    private IdempotencyRecordRepository idempotencyRecordRepository;

    @InjectMocks
    private TransactionService transactionService;

    @Test
    void depositShouldIncreaseBalance() {

        Account account = new Account();
        account.setAccountNumber("ACC100");
        account.setBalance(new BigDecimal("100.00"));
        account.setStatus(AccountStatus.ACTIVE);

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-001"))
                .thenReturn(Optional.empty());

        when(accountRepository.findByAccountNumberForUpdate("ACC100"))
                .thenReturn(Optional.of(account));

        transactionService.deposit(
                "ACC100", new BigDecimal("50.00"), "KEY-001");

        assertEquals(new BigDecimal("150.00"), account.getBalance());

        verify(transactionRepository, times(1))
                .save(any(Transaction.class));

        verify(ledgerEntryRepository, times(1))
                .save(any(LedgerEntry.class));

        verify(idempotencyRecordRepository, times(1))
                .saveAndFlush(any(IdempotencyRecord.class));
    }

    @Test
    void depositShouldRejectInvalidAmount() {

        assertThrows(
                IllegalArgumentException.class,
                () -> transactionService.deposit(
                        "ACC100", new BigDecimal("-50"), "KEY-002"));

        verifyNoInteractions(accountRepository);
    }

    @Test
    void duplicateDepositShouldReturnExistingTransaction()
            throws Exception {

        String requestData = "DEPOSIT|ACC100|50";
        byte[] hashBytes = MessageDigest.getInstance("SHA-256")
                .digest(requestData.getBytes(StandardCharsets.UTF_8));

        String requestHash = HexFormat.of().formatHex(hashBytes);

        Transaction existingTransaction = new Transaction();

        IdempotencyRecord record = new IdempotencyRecord();
        record.setIdempotencyKey("KEY-003");
        record.setRequestHash(requestHash);
        record.setTransaction(existingTransaction);

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-003"))
                .thenReturn(Optional.of(record));

        Transaction result = transactionService.deposit(
                "ACC100", new BigDecimal("50.00"), "KEY-003");

        assertSame(existingTransaction, result);

        verifyNoInteractions(accountRepository);
        verify(transactionRepository, never())
                .save(any(Transaction.class));
    }

    @Test
    void shouldRejectSameKeyWithDifferentRequest() {

        IdempotencyRecord record = new IdempotencyRecord();
        record.setIdempotencyKey("KEY-004");
        record.setRequestHash("different-request-hash");

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-004"))
                .thenReturn(Optional.of(record));

        assertThrows(
                IllegalArgumentException.class,
                () -> transactionService.deposit(
                        "ACC100", new BigDecimal("50.00"), "KEY-004"));

        verifyNoInteractions(accountRepository);
        verify(transactionRepository, never())
                .save(any(Transaction.class));
    }

    @Test
    void withdrawalShouldDecreaseBalance() {

        Account account = new Account();
        account.setAccountNumber("ACC100");
        account.setBalance(new BigDecimal("100.00"));
        account.setStatus(AccountStatus.ACTIVE);

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-005"))
                .thenReturn(Optional.empty());

        when(accountRepository.findByAccountNumberForUpdate("ACC100"))
                .thenReturn(Optional.of(account));

        transactionService.withdraw(
                "ACC100", new BigDecimal("30.00"), "KEY-005");

        assertEquals(new BigDecimal("70.00"), account.getBalance());

        verify(transactionRepository, times(1))
                .save(any(Transaction.class));

        verify(ledgerEntryRepository, times(1))
                .save(any(LedgerEntry.class));

        verify(idempotencyRecordRepository, times(1))
                .saveAndFlush(any(IdempotencyRecord.class));
    }

    @Test
    void withdrawalShouldRejectInsufficientBalance() {

        Account account = new Account();
        account.setAccountNumber("ACC100");
        account.setBalance(new BigDecimal("100.00"));
        account.setStatus(AccountStatus.ACTIVE);

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-006"))
                .thenReturn(Optional.empty());

        when(accountRepository.findByAccountNumberForUpdate("ACC100"))
                .thenReturn(Optional.of(account));

        assertThrows(
                IllegalArgumentException.class,
                () -> transactionService.withdraw(
                        "ACC100", new BigDecimal("150.00"), "KEY-006"));

        assertEquals(new BigDecimal("100.00"), account.getBalance());

        verify(transactionRepository, never())
                .save(any(Transaction.class));

        verify(ledgerEntryRepository, never())
                .save(any(LedgerEntry.class));
    }

    @Test
    void transferShouldUpdateBothAccountBalances() {

        Account sender = new Account();
        sender.setAccountNumber("ACC100");
        sender.setBalance(new BigDecimal("500.00"));
        sender.setStatus(AccountStatus.ACTIVE);

        Account receiver = new Account();
        receiver.setAccountNumber("ACC200");
        receiver.setBalance(new BigDecimal("200.00"));
        receiver.setStatus(AccountStatus.ACTIVE);

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-007"))
                .thenReturn(Optional.empty());

        when(accountRepository.findByAccountNumberForUpdate("ACC100"))
                .thenReturn(Optional.of(sender));

        when(accountRepository.findByAccountNumberForUpdate("ACC200"))
                .thenReturn(Optional.of(receiver));

        transactionService.transfer(
                "ACC100", "ACC200",
                new BigDecimal("100.00"), "KEY-007");

        assertEquals(new BigDecimal("400.00"), sender.getBalance());
        assertEquals(new BigDecimal("300.00"), receiver.getBalance());

        verify(transactionRepository, times(1))
                .save(any(Transaction.class));

        ArgumentCaptor<LedgerEntry> captor =
                ArgumentCaptor.forClass(LedgerEntry.class);

        verify(ledgerEntryRepository, times(2))
                .save(captor.capture());

        List<LedgerEntry> entries = captor.getAllValues();

        assertEquals(2, entries.size());

        assertEquals(LedgerEntryType.DEBIT,
                entries.get(0).getEntryType());

        assertEquals(LedgerEntryType.CREDIT,
                entries.get(1).getEntryType());

        assertEquals(new BigDecimal("100.00"),
                entries.get(0).getAmount());

        assertEquals(new BigDecimal("100.00"),
                entries.get(1).getAmount());

        verify(idempotencyRecordRepository, times(1))
                .saveAndFlush(any(IdempotencyRecord.class));
    }

    @Test
    void transferShouldRejectInsufficientBalance() {

        Account sender = new Account();
        sender.setAccountNumber("ACC100");
        sender.setBalance(new BigDecimal("50.00"));
        sender.setStatus(AccountStatus.ACTIVE);

        Account receiver = new Account();
        receiver.setAccountNumber("ACC200");
        receiver.setBalance(new BigDecimal("200.00"));
        receiver.setStatus(AccountStatus.ACTIVE);

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-008"))
                .thenReturn(Optional.empty());

        when(accountRepository.findByAccountNumberForUpdate("ACC100"))
                .thenReturn(Optional.of(sender));

        when(accountRepository.findByAccountNumberForUpdate("ACC200"))
                .thenReturn(Optional.of(receiver));

        assertThrows(
                IllegalArgumentException.class,
                () -> transactionService.transfer(
                        "ACC100", "ACC200",
                        new BigDecimal("100.00"), "KEY-008"));

        assertEquals(new BigDecimal("50.00"), sender.getBalance());
        assertEquals(new BigDecimal("200.00"), receiver.getBalance());

        verify(transactionRepository, never())
                .save(any(Transaction.class));

        verify(ledgerEntryRepository, never())
                .save(any(LedgerEntry.class));
    }

    @Test
    void duplicateTransferShouldReturnExistingTransaction()
            throws Exception {

        String requestData = "TRANSFER|ACC100|ACC200|100";
        byte[] hashBytes = MessageDigest.getInstance("SHA-256")
                .digest(requestData.getBytes(StandardCharsets.UTF_8));

        String requestHash = HexFormat.of().formatHex(hashBytes);

        Transaction existingTransaction = new Transaction();

        IdempotencyRecord record = new IdempotencyRecord();
        record.setIdempotencyKey("KEY-009");
        record.setRequestHash(requestHash);
        record.setTransaction(existingTransaction);

        when(idempotencyRecordRepository.findByIdempotencyKey("KEY-009"))
                .thenReturn(Optional.of(record));

        Transaction result = transactionService.transfer(
                "ACC100", "ACC200",
                new BigDecimal("100.00"), "KEY-009");

        assertSame(existingTransaction, result);

        verifyNoInteractions(accountRepository);

        verify(transactionRepository, never())
                .save(any(Transaction.class));

        verify(ledgerEntryRepository, never())
                .save(any(LedgerEntry.class));
    }
}
