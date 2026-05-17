package com.bookmyturf.dto.admin;

public record AdminItem(
        Long userId,
        String name,
        String email,
        String phone,
        String createdAt,
        boolean isSelf
) {}
