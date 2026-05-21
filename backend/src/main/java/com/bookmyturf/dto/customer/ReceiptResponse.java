package com.bookmyturf.dto.customer;

import java.math.BigDecimal;
import java.util.List;

public record ReceiptResponse(
        Long bookingId,
        String status,
        String bookedOn,
        CustomerInfo customer,
        TurfInfo turf,
        String bookingDate,
        List<SlotLine> slots,
        BigDecimal totalAmount,
        BigDecimal commissionAmount,
        BigDecimal ownerPayout,
        PaymentInfo payment,
        List<RefundInfo> refunds
) {
    public record CustomerInfo(String name, String email, String phone) {}

    public record TurfInfo(
            Long turfId,
            String turfName,
            String address,
            String city,
            String subCourtName,
            String ownerContact
    ) {}

    public record SlotLine(String startTime, String endTime, BigDecimal rateAtBooking) {}

    public record PaymentInfo(
            Long paymentId,
            String gatewayTransactionId,
            String paymentMethod,
            String paidOn,
            BigDecimal amount
    ) {}

    public record RefundInfo(
            Long refundId,
            BigDecimal amount,
            String razorpayRefundId,
            String status,
            String processedAt
    ) {}
}
