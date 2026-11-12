
package com.ledgerline.ledgerline.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ledgerline.ledgerline.dto.AccountResponse;
import com.ledgerline.ledgerline.dto.CreateAccountRequest;
import com.ledgerline.ledgerline.service.AccountService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/accounts")
@PreAuthorize("hasRole('CUSTOMER')")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping("/my")
    public ResponseEntity<List<AccountResponse>> getMyAccounts(
            Authentication authentication) {

        List<AccountResponse> accounts =
                accountService.getMyAccounts(authentication.getName());

        return ResponseEntity.ok(accounts);
    }

    @PostMapping
    public ResponseEntity<AccountResponse> createAccount(
            @Valid @RequestBody CreateAccountRequest request,
            Authentication authentication) {

        AccountResponse response =
                accountService.createAccount(authentication.getName(), request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
