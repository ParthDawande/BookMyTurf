package com.bookmyturf.dto.owner;

public record PhotoResponse(
        Long photoId,
        Long turfId,
        String photoUrl
) {}
