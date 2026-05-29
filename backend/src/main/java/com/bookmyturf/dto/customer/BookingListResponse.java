package com.bookmyturf.dto.customer;

import java.math.BigDecimal;
import java.util.List;

public record BookingListResponse(
        int page,
        int size,
        long totalResults,
        int totalPages,
        List<BookingListItem> bookings
) {
    public record BookingListItem(
            Long bookingId,
            String status,
            String bookedOn,
            Long turfId,
            String turfName,
            String subCourtName,
            String bookingDate,
            String firstSlotStart,
            String lastSlotEnd,
            BigDecimal totalAmount
    ) {}
}
