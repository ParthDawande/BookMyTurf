package com.bookmyturf.dto.customer;

public record CustomerComplaintDetailResponse(
        Long complaintId,
        Long bookingId,
        String subject,
        String description,
        String status,
        String createdAt,
        String resolvedAt
) {}
