package com.bookmyturf.dto.admin;

import java.math.BigDecimal;
import java.util.List;

public record PendingSubCourtItem(
        Long subCourtId,
        String name,
        List<String> sports,
        BigDecimal hourlyPrice,
        String openingHour,
        String closingHour,
        String status,
        TurfInfo turf,
        OwnerInfo owner
) {
    public record TurfInfo(Long turfId, String name, String city, String status) {}
    public record OwnerInfo(Long ownerId, String name, String phone) {}
}
