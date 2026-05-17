package com.bookmyturf.repository;

import com.bookmyturf.model.BookingSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BookingSlotRepository extends JpaRepository<BookingSlot, Long> {

    @Query("SELECT bs FROM BookingSlot bs WHERE bs.booking.id = :bookingId")
    List<BookingSlot> findByBookingId(@Param("bookingId") Long bookingId);
}
