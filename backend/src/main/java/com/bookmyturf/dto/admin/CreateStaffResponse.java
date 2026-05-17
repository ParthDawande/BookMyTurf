package com.bookmyturf.dto.admin;

public record CreateStaffResponse(
        Long userId,
        String name,
        String email,
        String phone,
        String role,
        String status,
        CreatedByAdmin createdByAdmin,
        String createdAt
) {
    public record CreatedByAdmin(Long adminId, String name) {}
}
