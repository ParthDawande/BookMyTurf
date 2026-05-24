package com.bookmyturf.dto.staff;

import com.bookmyturf.dto.admin.AdminComplaintListResponse;

import java.util.List;

public record StaffQueryDetailResponse(
        Long queryId,
        Long customerId,
        String customerName,
        String subject,
        String description,
        String status,
        String createdAt,
        List<AdminComplaintListResponse.NoteItem> notes
) {}
