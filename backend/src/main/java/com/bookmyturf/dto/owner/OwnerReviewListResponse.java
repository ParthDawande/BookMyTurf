package com.bookmyturf.dto.owner;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record OwnerReviewListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        Summary summary,
        List<ReviewItem> reviews
) {
    public record Summary(
            BigDecimal avgRating,
            long reviewCount,
            Map<Integer, Long> ratingBreakdown,
            long unrepliedCount
    ) {}

    public record ReviewItem(
            Long reviewId,
            Long turfId,
            String turfName,
            String customerName,
            Integer rating,
            String reviewText,
            String createdAt,
            ReplyInfo ownerReply
    ) {}

    public record ReplyInfo(
            String replyText,
            String createdAt
    ) {}
}
