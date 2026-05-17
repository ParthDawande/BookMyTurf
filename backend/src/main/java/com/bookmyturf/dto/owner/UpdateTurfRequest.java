package com.bookmyturf.dto.owner;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateTurfRequest(
        @Size(min = 5, max = 150) String name,
        @Size(max = 2000) String description,
        @Size(min = 5, max = 255) String address,
        @Size(min = 2, max = 80) String city,
        @Pattern(regexp = "^[0-9]{10}$", message = "must be a 10-digit phone number") String contactPhone,
        @Size(min = 1, message = "Photos list must not be empty if provided") List<String> photos
) {}
