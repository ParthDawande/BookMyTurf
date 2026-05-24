package com.bookmyturf.dto.owner;

public record ReplyResponse(
        Long replyId,
        Long reviewId,
        String replyText,
        String createdAt,
        boolean updated
) {}
