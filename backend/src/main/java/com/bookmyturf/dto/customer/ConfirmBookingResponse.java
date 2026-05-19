package com.bookmyturf.dto.customer;

import java.math.BigDecimal;
import java.util.List;

public record ConfirmBookingResponse(
        Long bookingId,
        String status,
        Long subCourtId,
        String subCourtName,
        String turfName,
        String bookingDate,
        List<SlotWithRate> slots,
        BigDecimal totalAmount,
        Long paymentId,
        String razorpayPaymentId,
        String createdAt
) {
    public record SlotWithRate(String startTime, String endTime, BigDecimal rateAtBooking) {}
}
