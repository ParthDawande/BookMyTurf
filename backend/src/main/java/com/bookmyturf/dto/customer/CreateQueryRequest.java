package com.bookmyturf.dto.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateQueryRequest(
        @NotBlank @Size(max = 200) String subject,
        @NotBlank String description
) {}
