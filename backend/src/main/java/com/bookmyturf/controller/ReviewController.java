package com.bookmyturf.controller;

import com.bookmyturf.dto.customer.CreateReviewRequest;
import com.bookmyturf.dto.customer.CreateReviewResponse;
import com.bookmyturf.dto.customer.DeleteReviewResponse;
import com.bookmyturf.dto.customer.UpdateReviewRequest;
import com.bookmyturf.dto.customer.UpdateReviewResponse;
import com.bookmyturf.dto.owner.OwnerReviewListResponse;
import com.bookmyturf.dto.owner.ReplyRequest;
import com.bookmyturf.dto.owner.ReplyResponse;
import com.bookmyturf.model.User;
import com.bookmyturf.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    // ── Customer endpoints ────────────────────────────────────────────────────

    @GetMapping("/api/customer/reviews/booking/{bookingId}")
    public ResponseEntity<CreateReviewResponse> getReviewByBooking(
            @AuthenticationPrincipal User user,
            @PathVariable Long bookingId) {
        return ResponseEntity.ok(reviewService.getReviewByBookingId(user, bookingId));
    }

    @PostMapping("/api/customer/reviews")
    public ResponseEntity<CreateReviewResponse> createReview(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateReviewRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reviewService.createReview(user, req));
    }

    @PutMapping("/api/customer/reviews/{id}")
    public ResponseEntity<UpdateReviewResponse> updateReview(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody UpdateReviewRequest req) {
        return ResponseEntity.ok(reviewService.updateReview(user, id, req));
    }

    @DeleteMapping("/api/customer/reviews/{id}")
    public ResponseEntity<DeleteReviewResponse> deleteReview(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return ResponseEntity.ok(reviewService.deleteReview(user, id));
    }

    // ── Owner endpoints ───────────────────────────────────────────────────────

    @GetMapping("/api/owner/reviews")
    public ResponseEntity<OwnerReviewListResponse> listOwnerReviews(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) Long turfId,
            @RequestParam(required = false) Integer minRating,
            @RequestParam(required = false) Integer maxRating,
            @RequestParam(required = false) Boolean replied,
            @RequestParam(required = false) String sortBy,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return ResponseEntity.ok(reviewService.listOwnerReviews(
                user, turfId, minRating, maxRating, replied, sortBy, page, pageSize));
    }

    @PostMapping("/api/owner/reviews/{id}/reply")
    public ResponseEntity<ReplyResponse> postReply(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody ReplyRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reviewService.postReply(user, id, req));
    }

    @PutMapping("/api/owner/reviews/{id}/reply")
    public ResponseEntity<ReplyResponse> updateReply(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody ReplyRequest req) {
        return ResponseEntity.ok(reviewService.updateReply(user, id, req));
    }

    @DeleteMapping("/api/owner/reviews/{id}/reply")
    public ResponseEntity<Void> deleteReply(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        reviewService.deleteReply(user, id);
        return ResponseEntity.noContent().build();
    }
}
