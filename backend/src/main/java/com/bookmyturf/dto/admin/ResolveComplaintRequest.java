package com.bookmyturf.dto.admin;

import jakarta.validation.constraints.NotBlank;

public record ResolveComplaintRequest(
        @NotBlank String resolutionNote
) {}
