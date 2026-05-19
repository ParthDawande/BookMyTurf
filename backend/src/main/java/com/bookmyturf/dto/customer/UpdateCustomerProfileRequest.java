package com.bookmyturf.dto.customer;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateCustomerProfileRequest(
        @Size(min = 2, max = 100, message = "Name must be 2-100 characters")
        String name,

        @Size(min = 2, max = 80, message = "City must be 2-80 characters")
        String city,

        @JsonProperty("preferred_sports")
        List<String> preferredSports
) {}
