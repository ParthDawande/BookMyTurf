package com.bookmyturf.dto.customer;

import jakarta.validation.constraints.NotBlank;

public record ConfirmBookingRequest(
        @NotBlank String razorpayOrderId,
        @NotBlank String razorpayPaymentId,
        @NotBlank String razorpaySignature
) {}
