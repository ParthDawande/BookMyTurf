package com.bookmyturf.dto.customer;

public record CustomerQueryDetailResponse(
        Long queryId,
        String subject,
        String description,
        String status,
        String createdAt,
        String resolvedAt
) {}
