
package com.ledgerline.ledgerline.controller;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ledgerline.ledgerline.dto.TransactionResponse;
import com.ledgerline.ledgerline.entity.Transaction;
import com.ledgerline.ledgerline.service.TransactionService;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    // DEPOSIT
    @PostMapping("/deposit")
    public ResponseEntity<TransactionResponse> deposit(
            @RequestParam String accountNumber,
            @RequestParam BigDecimal amount,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            Authentication authentication) {

        Transaction transaction = transactionService.deposit(
                accountNumber,
                amount,
                idempotencyKey,
                authentication.getName()
        );

        return ResponseEntity.ok(toResponse(transaction));
    }

    // WITHDRAWAL
    @PostMapping("/withdraw")
    public ResponseEntity<TransactionResponse> withdraw(
            @RequestParam String accountNumber,
            @RequestParam BigDecimal amount,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            Authentication authentication) {

        Transaction transaction = transactionService.withdraw(
                accountNumber,
                amount,
                idempotencyKey,
                authentication.getName()
        );

        return ResponseEntity.ok(toResponse(transaction));
    }

    // TRANSFER
    @PostMapping("/transfer")
    public ResponseEntity<TransactionResponse> transfer(
            @RequestParam String fromAccountNumber,
            @RequestParam String toAccountNumber,
            @RequestParam BigDecimal amount,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            Authentication authentication) {

        Transaction transaction = transactionService.transfer(
                fromAccountNumber,
                toAccountNumber,
                amount,
                idempotencyKey,
                authentication.getName()
        );

        return ResponseEntity.ok(toResponse(transaction));
    }

    // MY TRANSACTION HISTORY
    @GetMapping("/my")
    public ResponseEntity<List<TransactionResponse>> getMyTransactions(
            Authentication authentication) {

        List<TransactionResponse> transactions =
                transactionService.getMyTransactions(authentication.getName())
                        .stream()
                        .map(this::toResponse)
                        .toList();

        return ResponseEntity.ok(transactions);
    }

    // ENTITY TO DTO CONVERSION
    private TransactionResponse toResponse(Transaction transaction) {

        String sourceAccountNumber =
                transaction.getSourceAccount() != null
                        ? transaction.getSourceAccount().getAccountNumber()
                        : null;

        String destinationAccountNumber =
                transaction.getDestinationAccount() != null
                        ? transaction.getDestinationAccount().getAccountNumber()
                        : null;

        return new TransactionResponse(
                transaction.getId(),
                sourceAccountNumber,
                destinationAccountNumber,
                transaction.getAmount(),
                transaction.getType().name(),
                transaction.getStatus().name(),
                transaction.getCreatedAt() != null
                        ? transaction.getCreatedAt().toString()
                        : null
        );
    }
}
