package com.bookmyturf.dto.customer;

import java.math.BigDecimal;
import java.util.List;

public record RescheduleConfirmResponse(
        Long bookingId,
        String status,
        boolean rescheduled,
        String oldBookingDate,
        String newBookingDate,
        List<SlotWithRate> newSlots,
        BigDecimal totalAmount,
        BigDecimal priceDiff,
        String actionTaken,
        String rescheduledAt,
        Long additionalPaymentId,
        String razorpayPaymentId,
        Long refundId,
        String razorpayRefundId
) {
    public record SlotWithRate(String startTime, String endTime, BigDecimal rateAtBooking) {}
}
