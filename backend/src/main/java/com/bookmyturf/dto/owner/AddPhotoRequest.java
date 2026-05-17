package com.bookmyturf.dto.owner;

import jakarta.validation.constraints.NotBlank;

public record AddPhotoRequest(
        @NotBlank String photoUrl
) {}
