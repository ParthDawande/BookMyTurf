package com.bookmyturf.dto.customer;

public record UpdateReviewResponse(
        Long reviewId,
        Long turfId,
        String turfName,
        Long bookingId,
        Integer rating,
        String reviewText,
        String createdAt
) {}
