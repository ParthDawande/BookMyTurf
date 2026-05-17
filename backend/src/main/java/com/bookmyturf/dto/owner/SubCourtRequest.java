package com.bookmyturf.dto.owner;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

public record SubCourtRequest(
        @NotBlank @Size(min = 2, max = 80) String name,
        @NotNull @Size(min = 1, message = "At least one sport is required") List<String> sports,
        @NotNull @DecimalMin(value = "0.01", message = "Hourly price must be greater than 0") BigDecimal hourlyPrice,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime openingHour,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime closingHour
) {}
