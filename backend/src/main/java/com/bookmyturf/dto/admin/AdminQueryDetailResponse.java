package com.bookmyturf.dto.admin;

import java.util.List;

public record AdminQueryDetailResponse(
        Long queryId,
        Long customerId,
        String customerName,
        String subject,
        String description,
        String status,
        Long claimedByStaffId,
        String claimedByStaffName,
        String createdAt,
        String resolvedAt,
        List<AdminComplaintListResponse.NoteItem> notes
) {}
