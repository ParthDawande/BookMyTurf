package com.bookmyturf.dto.owner;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SubCourtResponse(
        Long subCourtId,
        Long turfId,
        String name,
        List<String> sports,
        BigDecimal hourlyPrice,
        String openingHour,
        String closingHour,
        String status,
        String previousStatus,
        String updatedAt
) {}
