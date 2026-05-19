package com.bookmyturf.dto.customer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record InitiateBookingRequest(
        @NotNull Long subCourtId,
        @NotBlank String bookingDate,
        @NotNull @Size(min = 1) @Valid List<SlotRequest> slots
) {
    public record SlotRequest(
            @NotBlank String startTime,
            @NotBlank String endTime
    ) {}
}
