package com.bookmyturf.dto.owner;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

public record UpdateSubCourtRequest(
        @Size(min = 2, max = 80) String name,
        List<String> sports,
        @DecimalMin(value = "0.01", message = "Hourly price must be greater than 0") BigDecimal hourlyPrice,
        @JsonFormat(pattern = "HH:mm") LocalTime openingHour,
        @JsonFormat(pattern = "HH:mm") LocalTime closingHour
) {}
