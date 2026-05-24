package com.bookmyturf.dto.staff;

import jakarta.validation.constraints.NotBlank;

public record StaffResolveRequest(
        @NotBlank String resolutionNote
) {}
