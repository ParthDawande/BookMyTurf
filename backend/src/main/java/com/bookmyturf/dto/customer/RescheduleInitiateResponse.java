package com.bookmyturf.dto.customer;

import java.math.BigDecimal;

/**
 * Response for POST /api/customer/bookings/{id}/reschedule/initiate.
 * action_required drives frontend behaviour:
 *   NONE    → call confirm immediately with just reschedule_token
 *   PAYMENT → launch Razorpay checkout, then confirm with token + 3 Razorpay fields
 *   REFUND  → confirm with just token; backend issues partial refund
 * razorpayOrderId / razorpayKeyId are non-null only for PAYMENT.
 */
public record RescheduleInitiateResponse(
        Long bookingId,
        BigDecimal oldTotal,
        BigDecimal newTotal,
        BigDecimal priceDiff,
        String actionRequired,
        String rescheduleToken,
        String razorpayOrderId,
        String razorpayKeyId
) {}
