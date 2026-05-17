package com.bookmyturf.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String error, Map<String, String> details) {

    public static ErrorResponse of(String error) {
        return new ErrorResponse(error, null);
    }

    public static ErrorResponse of(String error, Map<String, String> details) {
        return new ErrorResponse(error, details);
    }
}
