package com.bookmyturf.dto.auth;

public record LoginResponse(
        Long userId,
        String name,
        String email,
        String role,
        String token,
        String tokenExpiresAt
) {}
