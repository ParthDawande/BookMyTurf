package com.bookmyturf.dto.staff;

import com.bookmyturf.dto.admin.AdminComplaintListResponse;

import java.util.List;

public record StaffQueryListResponse(
        List<QueryItem> queries
) {
    public record QueryItem(
            Long queryId,
            Long customerId,
            String customerName,
            String subject,
            String status,
            String createdAt,
            List<AdminComplaintListResponse.NoteItem> notes
    ) {}
}
