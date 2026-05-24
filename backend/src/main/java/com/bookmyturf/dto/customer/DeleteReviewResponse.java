package com.bookmyturf.dto.customer;

import java.math.BigDecimal;

public record DeleteReviewResponse(
        Long reviewId,
        boolean deleted,
        Long turfId,
        BigDecimal updatedAvgRating,
        int updatedReviewCount
) {}
