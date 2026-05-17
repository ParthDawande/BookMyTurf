package com.bookmyturf.dto.admin;

public record TurfApprovalResponse(Long turfId, String status, String previousStatus) {}
