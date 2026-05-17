package com.bookmyturf.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Double-booking backstop — DB-level unique constraint approach:
 *
 * MySQL 8 has no partial/filtered indexes. We use the NULL trick:
 *   - slot_active = 1   → booking is CONFIRMED or COMPLETED (active)
 *   - slot_active = NULL → booking is CANCELLED or REFUNDED (excluded)
 *
 * MySQL unique indexes treat NULL as always-distinct, so cancelled/refunded rows
 * never participate in the uniqueness check and do NOT block re-booking of the same
 * physical slot. Only two rows both having slot_active = 1 for the same
 * (sub_court_id, booking_date, start_time) will collide.
 *
 * sub_court_id and booking_date are denormalized from the parent Booking to give
 * the unique index the columns it needs without a cross-table reference.
 *
 * Service layer (Phase 5) responsibility:
 *   - On booking creation: set subCourt = booking.subCourt, bookingDate = booking.bookingDate, slotActive = 1
 *   - On CANCEL/REFUND: set slotActive = null on all slots of that booking
 */
@Entity
@Table(name = "booking_slots",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_active_slot",
                columnNames = {"sub_court_id", "booking_date", "start_time", "slot_active"}
        ))
@Getter @Setter @NoArgsConstructor
public class BookingSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "rate_at_booking", nullable = false, precision = 10, scale = 2)
    private BigDecimal rateAtBooking;

    // Denormalized from Booking for the unique constraint backstop.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sub_court_id", nullable = false)
    private SubCourt subCourt;

    @Column(name = "booking_date", nullable = false)
    private LocalDate bookingDate;

    // 1 = active (CONFIRMED/COMPLETED); NULL = cancelled/refunded (excluded from unique index).
    // @ColumnDefault ensures DDL emits DEFAULT 1 — any INSERT omitting this column gets 1, not NULL.
    // nullable = true is intentional: explicit setSlotActive(null) must still persist for cancellation.
    @ColumnDefault("1")
    @Column(name = "slot_active")
    private Integer slotActive = 1;
}
