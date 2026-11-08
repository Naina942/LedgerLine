package com.ledgerline.ledgerline.dto;

import java.math.BigDecimal;

public record AccountResponse(
        String accountNumber,
        String accountType,
        BigDecimal balance,
        String currency,
        String status,
        String createdAt
) {}