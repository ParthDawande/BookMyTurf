package com.bookmyturf.dto.customer;

import java.math.BigDecimal;
import java.util.List;

public record AvailabilityResponse(
        Long turfId,
        String date,
        List<SubCourtSlots> subCourts
) {
    public record SubCourtSlots(
            Long subCourtId,
            String name,
            BigDecimal hourlyPrice,
            String openingHour,
            String closingHour,
            List<Slot> slots
    ) {}

    public record Slot(
            String startTime,
            String endTime,
            boolean available
    ) {}
}
