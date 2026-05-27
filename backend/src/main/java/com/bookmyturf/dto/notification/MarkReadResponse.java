package com.bookmyturf.dto.notification;

public record MarkReadResponse(
        Long id,
        Boolean isRead,
        String readAt
) {}
