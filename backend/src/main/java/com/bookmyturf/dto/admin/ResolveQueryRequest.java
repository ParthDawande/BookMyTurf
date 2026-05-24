package com.bookmyturf.dto.admin;

import jakarta.validation.constraints.NotBlank;

public record ResolveQueryRequest(
        @NotBlank String resolutionNote
) {}
