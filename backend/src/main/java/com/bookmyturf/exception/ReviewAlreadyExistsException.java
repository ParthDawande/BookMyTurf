package com.bookmyturf.exception;

public class ReviewAlreadyExistsException extends RuntimeException {

    private final Long existingReviewId;

    public ReviewAlreadyExistsException(Long existingReviewId) {
        super("You have already reviewed this booking");
        this.existingReviewId = existingReviewId;
    }

    public Long getExistingReviewId() {
        return existingReviewId;
    }
}
