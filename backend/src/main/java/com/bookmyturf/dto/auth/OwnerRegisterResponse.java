package com.bookmyturf.dto.auth;

public record OwnerRegisterResponse(
        Long userId,
        String name,
        String email,
        String phone,
        String role,
        boolean bankDetailsComplete,
        String token,
        String tokenExpiresAt,
        String note
) {}
