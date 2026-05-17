package com.bookmyturf.dto.owner;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TurfSummary(
        Long turfId,
        String name,
        String city,
        String address,
        @JsonInclude(JsonInclude.Include.ALWAYS) String coverPhotoUrl,
        List<String> allSports,
        Integer subCourtCount,
        BigDecimal minHourlyPrice,
        BigDecimal maxHourlyPrice,
        String status,
        BigDecimal avgRating,
        Integer reviewCount,
        String createdAt
) {}
