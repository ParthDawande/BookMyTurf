package com.bookmyturf.dto.publicapi;

import java.util.List;

public record CitiesResponse(
        int total,
        List<CityItem> cities
) {}
