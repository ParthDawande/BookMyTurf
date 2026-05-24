package com.bookmyturf.dto.customer;

import java.util.List;

public record ComplaintListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<ComplaintItem> complaints
) {
    public record ComplaintItem(
            Long complaintId,
            String subject,
            String status,
            String createdAt
    ) {}
}
