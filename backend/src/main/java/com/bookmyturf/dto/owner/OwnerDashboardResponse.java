package com.bookmyturf.dto.owner;

import java.math.BigDecimal;
import java.util.Map;

public record OwnerDashboardResponse(
        BigDecimal totalRevenue,
        BigDecimal totalCommission,
        BigDecimal ownerPayoutTotal,
        Map<String, Long> bookingsByStatus,
        PayoutsSummary payoutsSummary,
        Filters filters
) {
    public record PayoutsSummary(
            BigDecimal pendingAmount,
            BigDecimal paidAmount,
            BigDecimal cancelledAmount
    ) {}

    public record Filters(
            String fromDate,
            String toDate,
            Long turfId
    ) {}
}
