package com.bookmyturf.dto.admin;

import java.util.List;

public record AdminQueryListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<QueryItem> queries
) {
    public record QueryItem(
            Long queryId,
            Long customerId,
            String customerName,
            String subject,
            String status,
            Long claimedByStaffId,
            String claimedByStaffName,
            String createdAt,
            String resolvedAt,
            List<AdminComplaintListResponse.NoteItem> notes
    ) {}
}
