package com.bookmyturf.dto.staff;

import jakarta.validation.constraints.NotBlank;

public record AddNoteRequest(
        @NotBlank String note
) {}
