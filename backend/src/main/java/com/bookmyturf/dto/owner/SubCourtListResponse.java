package com.bookmyturf.dto.owner;

import java.util.List;

public record SubCourtListResponse(
        Long turfId,
        String turfName,
        String turfStatus,
        List<SubCourtResponse> subCourts
) {}
