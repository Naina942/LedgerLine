
package com.ledgerline.ledgerline.dto;

public record RegisterResponse(
        Long id,
        String username,
        String email,
        String role,
        String message
) {
}
