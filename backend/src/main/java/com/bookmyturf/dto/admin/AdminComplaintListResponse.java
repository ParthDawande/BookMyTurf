package com.bookmyturf.dto.admin;

import java.util.List;

public record AdminComplaintListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<ComplaintItem> complaints
) {
    public record ComplaintItem(
            Long complaintId,
            Long customerId,
            String customerName,
            Long bookingId,
            String subject,
            String status,
            Long assignedStaffId,
            String assignedStaffName,
            String createdAt,
            String resolvedAt,
            List<NoteItem> notes
    ) {}

    public record NoteItem(
            Long noteId,
            Long authorId,
            String noteText,
            String createdAt
    ) {}
}
