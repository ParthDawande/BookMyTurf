package com.bookmyturf.dto.staff;

import com.bookmyturf.dto.admin.AdminComplaintListResponse;

import java.util.List;

public record StaffComplaintListResponse(
        List<ComplaintItem> complaints
) {
    public record ComplaintItem(
            Long complaintId,
            Long customerId,
            String customerName,
            Long bookingId,
            String subject,
            String status,
            String createdAt,
            List<AdminComplaintListResponse.NoteItem> notes
    ) {}
}
