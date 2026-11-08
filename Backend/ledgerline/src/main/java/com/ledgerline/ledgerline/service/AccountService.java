
package com.ledgerline.ledgerline.service;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ledgerline.ledgerline.dto.AccountResponse;
import com.ledgerline.ledgerline.dto.CreateAccountRequest;
import com.ledgerline.ledgerline.entity.Account;
import com.ledgerline.ledgerline.entity.AccountStatus;
import com.ledgerline.ledgerline.entity.User;
import com.ledgerline.ledgerline.repository.AccountRepository;
import com.ledgerline.ledgerline.repository.UserRepository;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public AccountService(
            AccountRepository accountRepository,
            UserRepository userRepository) {
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> getMyAccounts(String username) {

        List<Account> accounts =
                accountRepository.findByOwnerUsername(username);

        return accounts.stream()
                .map(account -> new AccountResponse(
                        account.getAccountNumber(),
                        account.getAccountType().name(),
                        account.getBalance(),
                        account.getCurrency(),
                        account.getStatus().name(),
                        account.getCreatedAt() != null
                                ? account.getCreatedAt().toString()
                                : null
                ))
                .toList();
    }

    @Transactional
    public AccountResponse createAccount(
            String username,
            CreateAccountRequest request) {

        User owner = userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found"));

        String accountNumber = generateAccountNumber();

        Account account = new Account();
        account.setAccountNumber(accountNumber);
        account.setOwner(owner);
        account.setAccountType(request.getAccountType());
        account.setBalance(BigDecimal.ZERO);
        account.setCurrency("INR");
        account.setStatus(AccountStatus.ACTIVE);

        Account savedAccount = accountRepository.save(account);

        return new AccountResponse(
                savedAccount.getAccountNumber(),
                savedAccount.getAccountType().name(),
                savedAccount.getBalance(),
                savedAccount.getCurrency(),
                savedAccount.getStatus().name(),
                savedAccount.getCreatedAt() != null
                        ? savedAccount.getCreatedAt().toString()
                        : null
        );
    }

    private String generateAccountNumber() {

        String accountNumber;

        do {
            long number = 1_000_000_000_000_000L
                    + secureRandom.nextLong(9_000_000_000_000_000L);

            accountNumber = String.valueOf(number);

        } while (accountRepository.existsByAccountNumber(accountNumber));

        return accountNumber;
    }
}
