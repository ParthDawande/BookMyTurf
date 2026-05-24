package com.bookmyturf.dto.admin;

public record AssignComplaintResponse(
        Long complaintId,
        Long assignedStaffId,
        String assignedStaffName,
        String status
) {}
