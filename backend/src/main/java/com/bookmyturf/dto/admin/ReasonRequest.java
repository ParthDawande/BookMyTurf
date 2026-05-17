package com.bookmyturf.dto.admin;

import jakarta.validation.constraints.Size;

public record ReasonRequest(
        @Size(max = 500, message = "Reason must not exceed 500 characters")
        String reason
) {}
