package com.bookmyturf.dto.customer;

public record CreateReviewResponse(
        Long reviewId,
        Long turfId,
        String turfName,
        Long bookingId,
        Integer rating,
        String reviewText,
        String createdAt
) {}
