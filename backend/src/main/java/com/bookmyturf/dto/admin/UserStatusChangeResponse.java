package com.bookmyturf.dto.admin;

public record UserStatusChangeResponse(Long userId, String status, String previousStatus) {}
