package com.bookmyturf.dto.admin;

import java.util.List;

public record AdminComplaintDetailResponse(
        Long complaintId,
        Long customerId,
        String customerName,
        Long bookingId,
        String subject,
        String description,
        String status,
        Long assignedStaffId,
        String assignedStaffName,
        String createdAt,
        String resolvedAt,
        List<AdminComplaintListResponse.NoteItem> notes
) {}
