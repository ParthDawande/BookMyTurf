package com.bookmyturf.dto.customer;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CustomerTurfDetailResponse(
        Long turfId,
        String name,
        String description,
        String address,
        String city,
        String ownerPhone,
        List<String> photos,
        List<String> allSports,
        BigDecimal avgRating,
        Integer reviewCount,
        List<SubCourtItem> subCourts,
        List<ReviewItem> recentReviews
) {
    public record SubCourtItem(
            Long subCourtId,
            String name,
            List<String> sports,
            BigDecimal hourlyPrice,
            String openingHour,
            String closingHour
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ReviewItem(
            Long reviewId,
            String customerName,
            Integer rating,
            String reviewText,
            String createdAt,
            OwnerReply ownerReply
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record OwnerReply(
            String replyText,
            String createdAt
    ) {}
}
