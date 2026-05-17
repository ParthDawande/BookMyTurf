package com.bookmyturf.dto.admin;

import java.util.List;

public record PendingTurfListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<PendingTurfItem> turfs
) {}
