package com.bookmyturf.dto.admin;

import java.util.List;

public record AdminStaffListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<StaffItem> staff
) {
    public record StaffItem(
            Long userId,
            String name,
            String email,
            String phone,
            String status,
            String createdAt
    ) {}
}
