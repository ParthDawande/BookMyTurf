package com.bookmyturf.dto.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CustomerRegisterRequest(
        @NotBlank(message = "Name is required")
        @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^[0-9]{10}$", message = "Phone must be a 10-digit number")
        String phone,

        @NotBlank(message = "Password is required")
        @Pattern(
                regexp = "^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}$",
                message = "Password must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special character"
        )
        String password,

        @NotBlank(message = "City is required")
        @Size(min = 2, max = 80, message = "City must be between 2 and 80 characters")
        String city,

        @JsonProperty("preferred_sports")
        List<String> preferredSports
) {}
