package com.bookmyturf.dto.owner;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateOwnerProfileRequest(
        @Size(min = 2, max = 100) String name,
        @Pattern(regexp = "^[0-9]{9,18}$", message = "must be 9–18 digits") String bankAccountNumber,
        String ifscCode
) {}
