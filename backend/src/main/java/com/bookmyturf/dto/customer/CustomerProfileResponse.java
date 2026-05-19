package com.bookmyturf.dto.customer;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CustomerProfileResponse(
        Long userId,
        String name,
        String email,
        String phone,
        String city,
        List<String> preferredSports,
        String createdAt,
        String updatedAt
) {}
