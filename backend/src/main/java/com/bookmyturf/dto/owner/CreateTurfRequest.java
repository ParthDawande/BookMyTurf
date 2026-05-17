package com.bookmyturf.dto.owner;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

public record CreateTurfRequest(
        @NotBlank @Size(min = 5, max = 150) String name,
        @Size(max = 2000) String description,
        @NotBlank @Size(min = 5, max = 255) String address,
        @NotBlank @Size(min = 2, max = 80) String city,
        @NotBlank @Pattern(regexp = "^[0-9]{10}$", message = "must be a 10-digit phone number") String contactPhone,
        @NotEmpty List<String> photos,
        @NotNull @Size(min = 1, message = "At least one sub-court is required") @Valid List<SubCourtInCreate> subCourts
) {
    public record SubCourtInCreate(
            @NotBlank @Size(min = 2, max = 80) String name,
            @NotNull @Size(min = 1, message = "At least one sport is required") List<String> sports,
            @NotNull @DecimalMin(value = "0.01", message = "Hourly price must be greater than 0") BigDecimal hourlyPrice,
            @NotNull @JsonFormat(pattern = "HH:mm") LocalTime openingHour,
            @NotNull @JsonFormat(pattern = "HH:mm") LocalTime closingHour
    ) {}
}
