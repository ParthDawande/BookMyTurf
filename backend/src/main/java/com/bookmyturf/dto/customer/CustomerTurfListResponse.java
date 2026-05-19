package com.bookmyturf.dto.customer;

import java.util.List;

public record CustomerTurfListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<CustomerTurfSummary> turfs
) {}
