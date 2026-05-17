package com.bookmyturf.dto.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record OwnerRegisterRequest(
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

        // Optional; validated in service to return the specific error message the spec requires.
        @JsonProperty("bank_account_number")
        @Pattern(regexp = "^[0-9]{9,18}$", message = "Bank account number must be 9-18 digits")
        String bankAccountNumber,

        // Optional; IFSC pattern validated in service (not here) to emit the exact error: "Invalid IFSC code format".
        @JsonProperty("ifsc_code")
        String ifscCode
) {}
