
package com.ledgerline.ledgerline.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ledgerline.ledgerline.entity.Account;
import com.ledgerline.ledgerline.entity.AccountStatus;
import com.ledgerline.ledgerline.entity.IdempotencyRecord;
import com.ledgerline.ledgerline.entity.LedgerEntry;
import com.ledgerline.ledgerline.entity.LedgerEntryType;
import com.ledgerline.ledgerline.entity.Transaction;
import com.ledgerline.ledgerline.entity.TransactionStatus;
import com.ledgerline.ledgerline.entity.TransactionType;
import com.ledgerline.ledgerline.repository.AccountRepository;
import com.ledgerline.ledgerline.repository.IdempotencyRecordRepository;
import com.ledgerline.ledgerline.repository.LedgerEntryRepository;
import com.ledgerline.ledgerline.repository.TransactionRepository;

@Service
public class TransactionService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final IdempotencyRecordRepository idempotencyRecordRepository;

    public TransactionService(
            AccountRepository accountRepository,
            TransactionRepository transactionRepository,
            LedgerEntryRepository ledgerEntryRepository,
            IdempotencyRecordRepository idempotencyRecordRepository) {

        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.idempotencyRecordRepository = idempotencyRecordRepository;
    }

    // DEPOSIT
    @Transactional
    public Transaction deposit(
            String accountNumber,
            BigDecimal amount,
            String idempotencyKey) {

        validateAccountNumber(accountNumber);
        validateAmount(amount);

        String requestHash = generateHash(
                "DEPOSIT", accountNumber, normalizeAmount(amount));

        Optional<Transaction> existing =
                findExistingTransaction(idempotencyKey, requestHash);

        if (existing.isPresent()) {
            return existing.get();
        }

        Account account = accountRepository
                .findByAccountNumberForUpdate(accountNumber)
                .orElseThrow(() ->
                        new IllegalArgumentException("Account not found"));

        existing = findExistingTransaction(idempotencyKey, requestHash);

        if (existing.isPresent()) {
            return existing.get();
        }

        validateAccount(account);

        account.setBalance(account.getBalance().add(amount));
        accountRepository.save(account);

        Transaction transaction = new Transaction();
        transaction.setDestinationAccount(account);
        transaction.setAmount(amount);
        transaction.setType(TransactionType.DEPOSIT);
        transaction.setStatus(TransactionStatus.SUCCESS);

        transactionRepository.save(transaction);

        LedgerEntry entry = new LedgerEntry();
        entry.setTransaction(transaction);
        entry.setAccount(account);
        entry.setEntryType(LedgerEntryType.CREDIT);
        entry.setAmount(amount);

        ledgerEntryRepository.save(entry);

        saveIdempotencyRecord(idempotencyKey, requestHash, transaction);

        return transaction;
    }

    // WITHDRAWAL
    @Transactional
    public Transaction withdraw(
            String accountNumber,
            BigDecimal amount,
            String idempotencyKey) {

        validateAccountNumber(accountNumber);
        validateAmount(amount);

        String requestHash = generateHash(
                "WITHDRAWAL", accountNumber, normalizeAmount(amount));

        Optional<Transaction> existing =
                findExistingTransaction(idempotencyKey, requestHash);

        if (existing.isPresent()) {
            return existing.get();
        }

        Account account = accountRepository
                .findByAccountNumberForUpdate(accountNumber)
                .orElseThrow(() ->
                        new IllegalArgumentException("Account not found"));

        existing = findExistingTransaction(idempotencyKey, requestHash);

        if (existing.isPresent()) {
            return existing.get();
        }

        validateAccount(account);

        if (account.getBalance().compareTo(amount) < 0) {
            throw new IllegalArgumentException("Insufficient balance");
        }

        account.setBalance(account.getBalance().subtract(amount));
        accountRepository.save(account);

        Transaction transaction = new Transaction();
        transaction.setSourceAccount(account);
        transaction.setAmount(amount);
        transaction.setType(TransactionType.WITHDRAWAL);
        transaction.setStatus(TransactionStatus.SUCCESS);

        transactionRepository.save(transaction);

        LedgerEntry entry = new LedgerEntry();
        entry.setTransaction(transaction);
        entry.setAccount(account);
        entry.setEntryType(LedgerEntryType.DEBIT);
        entry.setAmount(amount);

        ledgerEntryRepository.save(entry);

        saveIdempotencyRecord(idempotencyKey, requestHash, transaction);

        return transaction;
    }

    // TRANSFER
    @Transactional
    public Transaction transfer(
            String fromAccountNumber,
            String toAccountNumber,
            BigDecimal amount,
            String idempotencyKey) {

        validateAccountNumber(fromAccountNumber);
        validateAccountNumber(toAccountNumber);
        validateAmount(amount);

        if (fromAccountNumber.equals(toAccountNumber)) {
            throw new IllegalArgumentException(
                    "Cannot transfer to the same account");
        }

        String requestHash = generateHash(
                "TRANSFER",
                fromAccountNumber,
                toAccountNumber,
                normalizeAmount(amount));

        Optional<Transaction> existing =
                findExistingTransaction(idempotencyKey, requestHash);

        if (existing.isPresent()) {
            return existing.get();
        }

        // Lock accounts in a consistent order.
        String firstAccountNumber =
                fromAccountNumber.compareTo(toAccountNumber) < 0
                        ? fromAccountNumber : toAccountNumber;

        String secondAccountNumber =
                fromAccountNumber.compareTo(toAccountNumber) < 0
                        ? toAccountNumber : fromAccountNumber;

        Account firstAccount = accountRepository
                .findByAccountNumberForUpdate(firstAccountNumber)
                .orElseThrow(() ->
                        new IllegalArgumentException("Account not found"));

        Account secondAccount = accountRepository
                .findByAccountNumberForUpdate(secondAccountNumber)
                .orElseThrow(() ->
                        new IllegalArgumentException("Account not found"));

        existing = findExistingTransaction(idempotencyKey, requestHash);

        if (existing.isPresent()) {
            return existing.get();
        }

        Account sender = fromAccountNumber.equals(firstAccountNumber)
                ? firstAccount : secondAccount;

        Account receiver = toAccountNumber.equals(firstAccountNumber)
                ? firstAccount : secondAccount;

        validateAccount(sender);
        validateAccount(receiver);

        if (sender.getBalance().compareTo(amount) < 0) {
            throw new IllegalArgumentException("Insufficient balance");
        }

        sender.setBalance(sender.getBalance().subtract(amount));
        receiver.setBalance(receiver.getBalance().add(amount));

        accountRepository.save(sender);
        accountRepository.save(receiver);

        Transaction transaction = new Transaction();
        transaction.setSourceAccount(sender);
        transaction.setDestinationAccount(receiver);
        transaction.setAmount(amount);
        transaction.setType(TransactionType.TRANSFER);
        transaction.setStatus(TransactionStatus.SUCCESS);

        transactionRepository.save(transaction);

        // Sender DEBIT
        LedgerEntry debit = new LedgerEntry();
        debit.setTransaction(transaction);
        debit.setAccount(sender);
        debit.setEntryType(LedgerEntryType.DEBIT);
        debit.setAmount(amount);

        ledgerEntryRepository.save(debit);

        // Receiver CREDIT
        LedgerEntry credit = new LedgerEntry();
        credit.setTransaction(transaction);
        credit.setAccount(receiver);
        credit.setEntryType(LedgerEntryType.CREDIT);
        credit.setAmount(amount);

        ledgerEntryRepository.save(credit);

        saveIdempotencyRecord(idempotencyKey, requestHash, transaction);

        return transaction;
    }

    // CHECK EXISTING REQUEST
    private Optional<Transaction> findExistingTransaction(
            String idempotencyKey,
            String requestHash) {

        validateIdempotencyKey(idempotencyKey);

        Optional<IdempotencyRecord> record =
                idempotencyRecordRepository
                        .findByIdempotencyKey(idempotencyKey);

        if (record.isEmpty()) {
            return Optional.empty();
        }

        IdempotencyRecord existingRecord = record.get();

        if (!existingRecord.getRequestHash().equals(requestHash)) {
            throw new IllegalArgumentException(
                    "Idempotency key already used for a different request");
        }

        if (existingRecord.getTransaction() == null) {
            throw new IllegalStateException(
                    "Transaction is not available for this request");
        }

        return Optional.of(existingRecord.getTransaction());
    }

    // SAVE IDEMPOTENCY RECORD
    private void saveIdempotencyRecord(
            String idempotencyKey,
            String requestHash,
            Transaction transaction) {

        IdempotencyRecord record = new IdempotencyRecord();
        record.setIdempotencyKey(idempotencyKey);
        record.setRequestHash(requestHash);
        record.setTransaction(transaction);

        // Database unique constraint protects concurrent duplicate keys.
        idempotencyRecordRepository.saveAndFlush(record);
    }

    // GENERATE SHA-256 REQUEST HASH
    private String generateHash(String... values) {

        try {
            String requestData = String.join("|", values);

            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    requestData.getBytes(StandardCharsets.UTF_8));

            return HexFormat.of().formatHex(hash);

        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(
                    "Unable to generate request hash", exception);
        }
    }

    private String normalizeAmount(BigDecimal amount) {
        return amount.stripTrailingZeros().toPlainString();
    }

    // VALIDATIONS
    private void validateAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Amount must be greater than zero");
        }
    }

    private void validateAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.isBlank()) {
            throw new IllegalArgumentException(
                    "Account number is required");
        }
    }

    private void validateIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null
                || idempotencyKey.isBlank()
                || idempotencyKey.length() > 100) {
            throw new IllegalArgumentException(
                    "A valid idempotency key is required (maximum 100 characters)");
        }
    }

    private void validateAccount(Account account) {
        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new IllegalArgumentException("Account is not active");
        }
    }
}
