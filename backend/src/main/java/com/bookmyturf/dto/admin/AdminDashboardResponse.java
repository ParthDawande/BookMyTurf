package com.bookmyturf.dto.admin;

import java.math.BigDecimal;
import java.util.Map;

public record AdminDashboardResponse(
        BigDecimal totalRevenue,
        BigDecimal platformCommission,
        BigDecimal ownersPayoutTotal,
        Map<String, Long> bookingsByStatus,
        PayoutsSummary payoutsSummary,
        PendingApprovals pendingApprovals,
        long openComplaints,
        long openQueries,
        ActiveUsers activeUsers,
        Filters filters
) {
    public record PayoutsSummary(
            BigDecimal pendingAmount,
            BigDecimal paidAmount,
            BigDecimal cancelledAmount
    ) {}

    public record PendingApprovals(
            long turfs,
            long subCourts
    ) {}

    public record ActiveUsers(
            long customers,
            long owners,
            long staff
    ) {}

    public record Filters(
            String fromDate,
            String toDate
    ) {}
}
