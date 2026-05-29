package com.bookmyturf.dto.admin;

import java.util.List;

public record AdminUserListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<UserItem> users
) {
    public record UserItem(
            Long userId,
            String name,
            String email,
            String phone,
            String role,
            String status,
            String createdAt
    ) {}
}
