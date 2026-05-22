package com.bookmyturf.repository;

import com.bookmyturf.model.BookingSlot;
import com.bookmyturf.model.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface BookingSlotRepository extends JpaRepository<BookingSlot, Long> {

    @Query("SELECT bs FROM BookingSlot bs WHERE bs.booking.id = :bookingId")
    List<BookingSlot> findByBookingId(@Param("bookingId") Long bookingId);

    // Returns start times of taken slots for the availability endpoint.
    // Derives from booking.status (CONFIRMED or COMPLETED) — NOT from slot_active —
    // so it is correct for read-only availability even before Phase 5B sets slot_active.
    @Query("SELECT bs.startTime FROM BookingSlot bs " +
           "WHERE bs.subCourt.id = :subCourtId " +
           "AND bs.bookingDate = :date " +
           "AND bs.booking.status IN :statuses")
    List<LocalTime> findTakenSlotStartTimes(@Param("subCourtId") Long subCourtId,
                                            @Param("date") LocalDate date,
                                            @Param("statuses") List<BookingStatus> statuses);

    // Same as above but excludes one specific booking — used by reschedule/initiate so
    // the customer's OWN existing slots are not counted as conflicts on the new date.
    @Query("SELECT bs.startTime FROM BookingSlot bs " +
           "WHERE bs.subCourt.id = :subCourtId " +
           "AND bs.bookingDate = :date " +
           "AND bs.booking.status IN :statuses " +
           "AND bs.booking.id <> :excludeBookingId")
    List<LocalTime> findTakenSlotStartTimesExcluding(
            @Param("subCourtId") Long subCourtId,
            @Param("date") LocalDate date,
            @Param("statuses") List<BookingStatus> statuses,
            @Param("excludeBookingId") Long excludeBookingId);
}
