package com.bookmyturf.dto.owner;

import java.math.BigDecimal;
import java.util.List;

public record OwnerPayoutListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<PayoutItem> payouts
) {
    public record PayoutItem(
            Long payoutId,
            Long bookingId,
            String turfName,
            String bookingDate,
            BigDecimal amount,
            String status,
            String scheduledAt,
            String paidAt
    ) {}
}
