package com.bookmyturf.dto.customer;

import java.math.BigDecimal;
import java.util.List;

public record CancelBookingResponse(
        Long bookingId,
        String status,
        String cancelledAt,
        List<RefundInfo> refunds,
        BigDecimal totalRefunded
) {
    public record RefundInfo(
            Long refundId,
            BigDecimal amount,
            String razorpayRefundId,
            String status,
            String processedAt
    ) {}
}
