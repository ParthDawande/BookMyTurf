package com.bookmyturf.dto.owner;

import java.util.List;

public record TurfListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<TurfSummary> turfs
) {}
