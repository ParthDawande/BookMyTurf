package com.bookmyturf.dto.customer;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

// cover_photo_url is ALWAYS present (key is never omitted, value may be null) — DECISIONS §6.
// Wire shape matches /api/owner/turfs list so one frontend component serves all three lists.
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CustomerTurfSummary(
        Long turfId,
        String name,
        String city,
        String address,
        @JsonInclude(JsonInclude.Include.ALWAYS) String coverPhotoUrl,
        List<String> sports,
        BigDecimal minHourlyPrice,
        BigDecimal maxHourlyPrice,
        BigDecimal avgRating,
        Integer reviewCount
) {}
