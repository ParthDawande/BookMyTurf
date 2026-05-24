package com.bookmyturf.service;

import com.bookmyturf.dto.customer.CreateReviewRequest;
import com.bookmyturf.dto.customer.CreateReviewResponse;
import com.bookmyturf.dto.customer.DeleteReviewResponse;
import com.bookmyturf.dto.customer.UpdateReviewRequest;
import com.bookmyturf.dto.customer.UpdateReviewResponse;
import com.bookmyturf.dto.owner.OwnerReviewListResponse;
import com.bookmyturf.dto.owner.ReplyRequest;
import com.bookmyturf.dto.owner.ReplyResponse;
import com.bookmyturf.exception.ReviewAlreadyExistsException;
import com.bookmyturf.model.*;
import com.bookmyturf.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewReplyRepository reviewReplyRepository;
    private final BookingRepository bookingRepository;
    private final TurfRepository turfRepository;
    private final CustomerProfileRepository customerProfileRepository;

    public ReviewService(ReviewRepository reviewRepository,
                         ReviewReplyRepository reviewReplyRepository,
                         BookingRepository bookingRepository,
                         TurfRepository turfRepository,
                         CustomerProfileRepository customerProfileRepository) {
        this.reviewRepository = reviewRepository;
        this.reviewReplyRepository = reviewReplyRepository;
        this.bookingRepository = bookingRepository;
        this.turfRepository = turfRepository;
        this.customerProfileRepository = customerProfileRepository;
    }

    // -------------------------------------------------------------------------
    // POST /api/customer/reviews — create review
    // -------------------------------------------------------------------------

    @Transactional
    public CreateReviewResponse createReview(User customer, CreateReviewRequest req) {

        // 1. Fetch booking — 404 if not found.
        Booking booking = bookingRepository.findById(req.bookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        // 2. Ownership check — 404-not-403 (no-leak pattern, prompt §ownership).
        if (!booking.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        }

        // 3. Status guard — COMPLETED only. DECISIONS §3: REFUNDED is terminal/dead, never reviewable.
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reviews can only be posted on completed bookings");
        }

        // 4. Uniqueness check — application-side for clean error, UNIQUE constraint is DB backstop.
        reviewRepository.findByBookingId(req.bookingId()).ifPresent(existing -> {
            throw new ReviewAlreadyExistsException(existing.getId());
        });

        // 5. Insert review.
        Turf turf = booking.getSubCourt().getTurf();
        Review review = new Review();
        review.setCustomer(customer);
        review.setTurf(turf);
        review.setBooking(booking);
        review.setRating(req.rating());
        review.setReviewText(req.reviewText());
        review = reviewRepository.save(review);

        // 6. Recompute avg_rating and review_count on parent turf (same transaction).
        recomputeTurfRating(turf);

        return new CreateReviewResponse(
                review.getId(),
                turf.getId(),
                turf.getName(),
                booking.getId(),
                review.getRating(),
                review.getReviewText(),
                review.getCreatedAt() != null ? review.getCreatedAt().toString() : null
        );
    }

    // -------------------------------------------------------------------------
    // PUT /api/customer/reviews/{id} — update review (rating + text)
    // -------------------------------------------------------------------------

    @Transactional
    public UpdateReviewResponse updateReview(User customer, Long reviewId, UpdateReviewRequest req) {

        // 1. Fetch review — 404-not-403 for missing or not-owned (no-leak).
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        if (!review.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found");
        }

        // 2. Apply update. Only recompute rating if rating actually changed.
        boolean ratingChanged = !review.getRating().equals(req.rating());
        review.setRating(req.rating());
        review.setReviewText(req.reviewText());
        reviewRepository.save(review);

        // 3. Recompute avg_rating only when rating changed (prompt §rating recompute).
        if (ratingChanged) {
            recomputeTurfRating(review.getTurf());
        }

        Turf turf = review.getTurf();
        return new UpdateReviewResponse(
                review.getId(),
                turf.getId(),
                turf.getName(),
                review.getBooking().getId(),
                review.getRating(),
                review.getReviewText(),
                review.getCreatedAt() != null ? review.getCreatedAt().toString() : null
        );
    }

    // -------------------------------------------------------------------------
    // DELETE /api/customer/reviews/{id} — delete review + cascade reply
    // -------------------------------------------------------------------------

    @Transactional
    public DeleteReviewResponse deleteReview(User customer, Long reviewId) {

        // 1. Fetch review — 404-not-403 for missing or not-owned (no-leak).
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        if (!review.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found");
        }

        Long turfId = review.getTurf().getId();
        Turf turf = review.getTurf();

        // 2. Delete review. JPA cascades (CascadeType.ALL + orphanRemoval=true on Review.reply)
        //    deletes the ReviewReply if present. DB-level ON DELETE CASCADE on review_replies.review_id
        //    is a second safety net.
        reviewRepository.delete(review);
        reviewRepository.flush(); // flush before aggregate re-query so deleted row is excluded.

        // 3. Recompute after delete — explicit 0.0 / 0 when last review is gone.
        recomputeTurfRating(turf);

        return new DeleteReviewResponse(
                reviewId,
                true,
                turfId,
                turf.getAvgRating(),
                turf.getReviewCount()
        );
    }

    // -------------------------------------------------------------------------
    // GET /api/owner/reviews — owner sees all reviews on their turfs
    // -------------------------------------------------------------------------

    public OwnerReviewListResponse listOwnerReviews(User owner,
                                                     Long turfId,
                                                     Integer minRating,
                                                     Integer maxRating,
                                                     Boolean replied,
                                                     String sortBy,
                                                     int page,
                                                     int pageSize) {
        // 1. If turf_id provided, verify ownership (404-not-403 per prompt).
        if (turfId != null) {
            turfRepository.findByIdAndOwnerId(turfId, owner.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Turf not found"));
        }

        // 2. Fetch all reviews for owner (or specific turf). Java-side filtering follows.
        List<Review> all = (turfId != null)
                ? reviewRepository.findAllForOwnerByTurf(owner.getId(), turfId)
                : reviewRepository.findAllForOwner(owner.getId());

        // 3. Batch-load replies to avoid N+1 on the full list.
        List<Long> reviewIds = all.stream().map(Review::getId).collect(Collectors.toList());
        Map<Long, ReviewReply> replyByReviewId = reviewIds.isEmpty()
                ? Collections.emptyMap()
                : reviewReplyRepository.findByReviewIdIn(reviewIds).stream()
                        .collect(Collectors.toMap(rr -> rr.getReview().getId(), rr -> rr));

        // 4. Apply Java-side filters.
        List<Review> filtered = all.stream()
                .filter(r -> minRating == null || r.getRating() >= minRating)
                .filter(r -> maxRating == null || r.getRating() <= maxRating)
                .filter(r -> {
                    if (replied == null) return true;
                    boolean hasReply = replyByReviewId.containsKey(r.getId());
                    return replied ? hasReply : !hasReply;
                })
                .collect(Collectors.toList());

        // 5. Compute summary from the full filtered set (not just the page).
        long reviewCount = filtered.size();
        double rawAvg = filtered.stream().mapToInt(Review::getRating).average().orElse(0.0);
        BigDecimal avgRating = reviewCount > 0
                ? new BigDecimal(rawAvg).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<Integer, Long> breakdown = new LinkedHashMap<>();
        breakdown.put(5, 0L); breakdown.put(4, 0L); breakdown.put(3, 0L);
        breakdown.put(2, 0L); breakdown.put(1, 0L);
        filtered.forEach(r -> breakdown.merge(r.getRating(), 1L, Long::sum));

        long unrepliedCount = filtered.stream()
                .filter(r -> !replyByReviewId.containsKey(r.getId()))
                .count();

        OwnerReviewListResponse.Summary summary = new OwnerReviewListResponse.Summary(
                avgRating, reviewCount, breakdown, unrepliedCount);

        // 6. Sort.
        Comparator<Review> comparator = switch (sortBy == null ? "created_desc" : sortBy) {
            case "created_asc"  -> Comparator.comparing(Review::getCreatedAt);
            case "rating_desc"  -> Comparator.comparingInt(Review::getRating).reversed();
            case "rating_asc"   -> Comparator.comparingInt(Review::getRating);
            default             -> Comparator.comparing(Review::getCreatedAt, Comparator.reverseOrder());
        };
        filtered.sort(comparator);

        // 7. Paginate (page is 1-indexed per API_DOC).
        int clampedPageSize = Math.min(Math.max(pageSize, 1), 50);
        int clampedPage = Math.max(page, 1);
        int totalPages = reviewCount == 0 ? 1 : (int) Math.ceil((double) reviewCount / clampedPageSize);
        int fromIndex = (clampedPage - 1) * clampedPageSize;
        int toIndex = Math.min(fromIndex + clampedPageSize, (int) reviewCount);
        List<Review> pageSlice = (fromIndex >= filtered.size()) ? Collections.emptyList()
                : filtered.subList(fromIndex, toIndex);

        // 8. Map page items. Customer profiles fetched individually (N+1 for page_size, acceptable).
        List<OwnerReviewListResponse.ReviewItem> items = pageSlice.stream().map(r -> {
            String customerName = customerProfileRepository.findById(r.getCustomer().getId())
                    .map(CustomerProfile::getName).orElse("Unknown");

            ReviewReply rr = replyByReviewId.get(r.getId());
            OwnerReviewListResponse.ReplyInfo replyInfo = rr == null ? null
                    : new OwnerReviewListResponse.ReplyInfo(
                            rr.getReplyText(),
                            rr.getCreatedAt() != null ? rr.getCreatedAt().toString() : null);

            return new OwnerReviewListResponse.ReviewItem(
                    r.getId(),
                    r.getTurf().getId(),
                    r.getTurf().getName(),
                    customerName,
                    r.getRating(),
                    r.getReviewText(),
                    r.getCreatedAt() != null ? r.getCreatedAt().toString() : null,
                    replyInfo
            );
        }).collect(Collectors.toList());

        return new OwnerReviewListResponse(clampedPage, clampedPageSize, reviewCount, totalPages, summary, items);
    }

    // -------------------------------------------------------------------------
    // POST /api/owner/reviews/{id}/reply — create reply (rejects if already exists)
    // -------------------------------------------------------------------------

    @Transactional
    public ReplyResponse postReply(User owner, Long reviewId, ReplyRequest req) {

        // 1. Fetch review — 404 if not found.
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        // 2. Ownership check — 404-not-403 (no-leak, prompt §ownership).
        if (!review.getTurf().getOwner().getId().equals(owner.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found");
        }

        // 3. Reject 400 if a reply already exists (prompt overrides API_DOC upsert).
        if (reviewReplyRepository.findByReviewId(reviewId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A reply already exists for this review");
        }

        // 4. Insert reply.
        ReviewReply reply = new ReviewReply();
        reply.setReview(review);
        reply.setOwner(owner);
        reply.setReplyText(req.replyText().trim());
        reply = reviewReplyRepository.save(reply);

        return new ReplyResponse(
                reply.getId(),
                reviewId,
                reply.getReplyText(),
                reply.getCreatedAt() != null ? reply.getCreatedAt().toString() : null,
                false
        );
    }

    // -------------------------------------------------------------------------
    // PUT /api/owner/reviews/{id}/reply — update existing reply
    // -------------------------------------------------------------------------

    @Transactional
    public ReplyResponse updateReply(User owner, Long reviewId, ReplyRequest req) {

        // 1. Fetch review — 404 if not found.
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        // 2. Ownership check — 404-not-403.
        if (!review.getTurf().getOwner().getId().equals(owner.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found");
        }

        // 3. Fetch the existing reply — 404 if none exists yet.
        ReviewReply reply = reviewReplyRepository.findByReviewId(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply not found"));

        // 4. Update text. @PreUpdate sets updated_at.
        reply.setReplyText(req.replyText().trim());
        reply = reviewReplyRepository.save(reply);

        return new ReplyResponse(
                reply.getId(),
                reviewId,
                reply.getReplyText(),
                reply.getCreatedAt() != null ? reply.getCreatedAt().toString() : null,
                true
        );
    }

    // -------------------------------------------------------------------------
    // DELETE /api/owner/reviews/{id}/reply — delete reply, leaves review intact
    // -------------------------------------------------------------------------

    @Transactional
    public void deleteReply(User owner, Long reviewId) {

        // 1. Fetch review — 404 if not found.
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        // 2. Ownership check — 404-not-403.
        if (!review.getTurf().getOwner().getId().equals(owner.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found");
        }

        // 3. Fetch reply — 404 if none.
        ReviewReply reply = reviewReplyRepository.findByReviewId(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply not found"));

        // 4. Delete reply only — review stays intact.
        // Use bulk JPQL delete to bypass orphanRemoval conflict on Review.reply (CascadeType.ALL).
        reviewReplyRepository.deleteByReplyId(reply.getId());
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    // Recompute avg_rating and review_count on the turf within the current transaction.
    // Hibernate flushes pending changes before executing the aggregate JPQL, so the
    // result correctly reflects any insert or delete that preceded this call.
    // DIVIDE-BY-ZERO GUARD: when count = 0, explicitly writes 0.0 and 0.
    private void recomputeTurfRating(Turf turf) {
        List<Object[]> result = reviewRepository.computeAggregateByTurfId(turf.getId());
        if (result.isEmpty() || result.get(0)[1] == null
                || ((Number) result.get(0)[1]).longValue() == 0) {
            turf.setAvgRating(BigDecimal.ZERO);
            turf.setReviewCount(0);
        } else {
            Object[] row = result.get(0);
            double avg = ((Number) row[0]).doubleValue();
            long count = ((Number) row[1]).longValue();
            turf.setAvgRating(new BigDecimal(avg).setScale(1, RoundingMode.HALF_UP));
            turf.setReviewCount((int) count);
        }
        turfRepository.save(turf);
    }
}
