package com.bookmyturf.dto.customer;

import java.math.BigDecimal;
import java.util.List;

public record InitiateBookingResponse(
        Long subCourtId,
        String subCourtName,
        String turfName,
        String bookingDate,
        List<SlotWithRate> slots,
        BigDecimal totalAmount,
        String razorpayOrderId,
        String razorpayKeyId
) {
    public record SlotWithRate(String startTime, String endTime, BigDecimal rateAtBooking) {}
}
