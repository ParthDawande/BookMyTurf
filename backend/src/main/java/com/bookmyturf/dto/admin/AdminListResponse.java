package com.bookmyturf.dto.admin;

import java.util.List;

public record AdminListResponse(
        int page,
        int pageSize,
        long totalResults,
        int totalPages,
        List<AdminItem> admins
) {}
