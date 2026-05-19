package com.bookmyturf.dto.publicapi;

import java.util.List;

public record PublicTurfListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<PublicTurfSummary> turfs
) {}
