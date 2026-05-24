package com.bookmyturf.dto.admin;

public record ResolveQueryResponse(
        Long queryId,
        String status,
        Long resolutionNoteId,
        String resolvedAt
) {}
