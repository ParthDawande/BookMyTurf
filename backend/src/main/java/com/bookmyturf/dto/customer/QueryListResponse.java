package com.bookmyturf.dto.customer;

import java.util.List;

public record QueryListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<QueryItem> queries
) {
    public record QueryItem(
            Long queryId,
            String subject,
            String status,
            String createdAt
    ) {}
}
