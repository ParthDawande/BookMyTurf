package com.bookmyturf.repository;

import com.bookmyturf.model.Payout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PayoutRepository extends JpaRepository<Payout, Long> {

    @Query("SELECT p FROM Payout p WHERE p.booking.id = :bookingId")
    Optional<Payout> findByBookingId(@Param("bookingId") Long bookingId);
}
