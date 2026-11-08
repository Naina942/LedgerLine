package com.ledgerline.ledgerline.dto;

public record LoginResponse(
        String token,
        String tokenType,
        Long userId,
        String username,
        String role,
        String message
) {}