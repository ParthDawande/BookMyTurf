package com.bookmyturf.dto.staff;

import com.bookmyturf.dto.admin.AdminComplaintListResponse;

import java.util.List;

public record StaffComplaintDetailResponse(
        Long complaintId,
        Long customerId,
        String customerName,
        Long bookingId,
        String subject,
        String description,
        String status,
        String createdAt,
        List<AdminComplaintListResponse.NoteItem> notes
) {}
