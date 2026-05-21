package com.bookmyturf.repository;

import com.bookmyturf.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    // Returns payments where booking_id = :bookingId — never race-recovery rows (booking_id NULL).
    @Query("SELECT p FROM Payment p WHERE p.booking.id = :bookingId ORDER BY p.createdAt DESC")
    List<Payment> findByBookingId(@Param("bookingId") Long bookingId);
}
