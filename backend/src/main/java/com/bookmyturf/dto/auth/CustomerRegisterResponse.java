package com.bookmyturf.dto.auth;

// SNAKE_CASE naming strategy (application.properties) serializes camelCase fields to snake_case.
// userId → user_id, tokenExpiresAt → token_expires_at, etc.
public record CustomerRegisterResponse(
        Long userId,
        String name,
        String email,
        String phone,
        String city,
        String role,
        String token,
        String tokenExpiresAt
) {}
