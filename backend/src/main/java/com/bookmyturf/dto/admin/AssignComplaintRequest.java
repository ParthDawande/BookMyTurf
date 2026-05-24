package com.bookmyturf.dto.admin;

import jakarta.validation.constraints.NotNull;

public record AssignComplaintRequest(
        @NotNull Long staffId
) {}
