package com.bookmyturf.dto.owner;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OwnerProfileResponse(
        Long userId,
        String name,
        String email,
        String phone,
        String bankAccountNumber,
        String ifscCode,
        boolean bankDetailsComplete,
        String createdAt,
        String updatedAt
) {}
