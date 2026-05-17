package com.bookmyturf.dto.admin;

public record CreateAdminResponse(
        Long userId,
        String name,
        String email,
        String phone,
        String role,
        String status,
        String createdAt
) {}
