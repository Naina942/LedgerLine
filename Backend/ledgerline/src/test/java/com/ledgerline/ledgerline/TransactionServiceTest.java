
package com.ledgerline.ledgerline;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
                "ACC100",
                new BigDecimal("50.00"),
                "KEY-001");

        assertEquals(
                new BigDecimal("150.00"),
                account.getBalance());

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
                        "ACC100",
                        new BigDecimal("-50"),
                        "KEY-002"));

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
                "ACC100",
                new BigDecimal("50.00"),
                "KEY-003");

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
                    "ACC100",
                    new BigDecimal("50.00"),
                    "KEY-004"));

    verifyNoInteractions(accountRepository);
    verify(transactionRepository, never())
            .save(any(Transaction.class));
}
}
