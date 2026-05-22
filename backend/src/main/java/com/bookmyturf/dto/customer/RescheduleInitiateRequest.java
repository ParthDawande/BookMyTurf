package com.bookmyturf.dto.customer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RescheduleInitiateRequest(
        @NotBlank String newBookingDate,
        @NotNull @Size(min = 1) @Valid List<InitiateBookingRequest.SlotRequest> newSlots
) {}
