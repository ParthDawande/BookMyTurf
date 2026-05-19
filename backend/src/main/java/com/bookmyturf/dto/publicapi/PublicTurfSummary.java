package com.bookmyturf.dto.publicapi;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

// cover_photo_url is ALWAYS present (key never omitted, value may be null) — DECISIONS §6.
// Wire shape matches /api/owner/turfs and /api/customer/turfs for the cover_photo_url field.
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublicTurfSummary(
        Long turfId,
        String name,
        String city,
        String address,
        @JsonInclude(JsonInclude.Include.ALWAYS) String coverPhotoUrl,
        BigDecimal minHourlyPrice,
        BigDecimal maxHourlyPrice,
        List<String> sports,
        BigDecimal avgRating,
        Integer reviewCount
) {}
