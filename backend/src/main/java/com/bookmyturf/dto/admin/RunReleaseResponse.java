package com.bookmyturf.dto.admin;

import java.util.List;

public record RunReleaseResponse(
        int payoutsReleased,
        List<Long> releasedIds
) {}
