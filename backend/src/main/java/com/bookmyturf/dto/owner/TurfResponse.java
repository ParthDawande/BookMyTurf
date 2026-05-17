package com.bookmyturf.dto.owner;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TurfResponse(
        Long turfId,
        Long ownerId,
        String name,
        String description,
        String address,
        String city,
        String contactPhone,
        String status,
        String previousStatus,
        BigDecimal avgRating,
        Integer reviewCount,
        List<String> allSports,
        List<String> photos,
        List<SubCourtItem> subCourts,
        String createdAt,
        String updatedAt
) {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SubCourtItem(
            Long subCourtId,
            String name,
            List<String> sports,
            BigDecimal hourlyPrice,
            String openingHour,
            String closingHour,
            String status
    ) {}
}
