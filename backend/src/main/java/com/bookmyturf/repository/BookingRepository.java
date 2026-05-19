package com.bookmyturf.repository;

import com.bookmyturf.model.Booking;
import com.bookmyturf.model.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Query("SELECT b FROM Booking b WHERE b.subCourt.id = :subCourtId AND b.status = :status AND b.bookingDate >= :today")
    List<Booking> findUpcomingBySubCourtIdAndStatus(@Param("subCourtId") Long subCourtId,
                                                    @Param("status") BookingStatus status,
                                                    @Param("today") LocalDate today);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.subCourt.id IN :ids")
    long countBySubCourtIdIn(@Param("ids") List<Long> ids);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.subCourt.id = :id")
    long countBySubCourtId(@Param("id") Long id);

    // Contract B: block deletion only for CONFIRMED or COMPLETED bookings.
    // CANCELLED and REFUNDED are terminal dead states (DECISIONS.md §3) and must NOT block.
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.subCourt.id IN :ids AND b.status IN :statuses")
    long countBySubCourtIdInAndStatusIn(@Param("ids") List<Long> ids,
                                        @Param("statuses") List<BookingStatus> statuses);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.subCourt.id = :id AND b.status IN :statuses")
    long countBySubCourtIdAndStatusIn(@Param("id") Long id,
                                      @Param("statuses") List<BookingStatus> statuses);
}
