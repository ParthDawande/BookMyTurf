package com.bookmyturf.dto.admin;

import java.util.List;

public record PendingSubCourtListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<PendingSubCourtItem> subCourts
) {}
