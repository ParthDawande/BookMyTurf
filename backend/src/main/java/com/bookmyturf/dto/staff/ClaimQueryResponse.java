package com.bookmyturf.dto.staff;

public record ClaimQueryResponse(
        Long queryId,
        String status,
        Long staffId,
        String claimedAt
) {}
