package com.bookmyturf.dto.admin;

public record ResolveComplaintResponse(
        Long complaintId,
        String status,
        Long resolutionNoteId,
        String resolvedAt
) {}
