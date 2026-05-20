package com.bookmyturf.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "refunds")
@Getter @Setter @NoArgsConstructor
public class Refund {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // nullable = true: race-path recovery rows have no associated booking.
    // Phase-6 cancellation refunds always have a booking set.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "razorpay_refund_id", length = 100)
    private String razorpayRefundId;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private RefundStatus status;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;
}
