package com.bookmyturf.dto.customer;

import jakarta.validation.constraints.NotBlank;

public record RescheduleConfirmRequest(
        @NotBlank String rescheduleToken,
        String razorpayOrderId,
        String razorpayPaymentId,
        String razorpaySignature
) {}
