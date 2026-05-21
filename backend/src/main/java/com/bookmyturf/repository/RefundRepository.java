package com.bookmyturf.repository;

import com.bookmyturf.model.Refund;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RefundRepository extends JpaRepository<Refund, Long> {

    // JPQL r.booking.id = :bookingId translates to WHERE booking_id = :bookingId.
    // InnoDB evaluates equality against NULL as false, so race-recovery refunds
    // (booking_id IS NULL) are NEVER returned here — they cannot appear on any receipt.
    @Query("SELECT r FROM Refund r WHERE r.booking.id = :bookingId ORDER BY r.processedAt ASC")
    List<Refund> findByBookingId(@Param("bookingId") Long bookingId);
}
