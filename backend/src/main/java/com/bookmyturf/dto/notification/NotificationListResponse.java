package com.bookmyturf.dto.notification;

import java.util.List;

public record NotificationListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<NotificationItem> notifications
) {
    public record NotificationItem(
            Long id,
            String type,
            String message,
            Boolean isRead,
            String createdAt
    ) {}
}
