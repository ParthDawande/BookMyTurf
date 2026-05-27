package com.bookmyturf.repository;

import com.bookmyturf.model.Booking;
import com.bookmyturf.model.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

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

    // Dashboard aggregations — owner-scoped via booking → sub_court → turf → owner_id.
    // booking_date is a LocalDate column: compare directly with LocalDate params (no TZ conversion).

    @Query("SELECT b.status, COUNT(b) FROM Booking b " +
           "JOIN b.subCourt sc JOIN sc.turf t " +
           "WHERE t.owner.id = :ownerId " +
           "AND (:turfId IS NULL OR t.id = :turfId) " +
           "AND (:fromDate IS NULL OR b.bookingDate >= :fromDate) " +
           "AND (:toDate IS NULL OR b.bookingDate <= :toDate) " +
           "GROUP BY b.status")
    List<Object[]> countByStatusForOwner(@Param("ownerId") Long ownerId,
                                          @Param("turfId") Long turfId,
                                          @Param("fromDate") LocalDate fromDate,
                                          @Param("toDate") LocalDate toDate);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0), COALESCE(SUM(b.commissionAmount), 0) FROM Booking b " +
           "JOIN b.subCourt sc JOIN sc.turf t " +
           "WHERE t.owner.id = :ownerId " +
           "AND b.status IN :statuses " +
           "AND (:turfId IS NULL OR t.id = :turfId) " +
           "AND (:fromDate IS NULL OR b.bookingDate >= :fromDate) " +
           "AND (:toDate IS NULL OR b.bookingDate <= :toDate)")
    List<Object[]> revenueByOwner(@Param("ownerId") Long ownerId,
                                   @Param("statuses") List<BookingStatus> statuses,
                                   @Param("turfId") Long turfId,
                                   @Param("fromDate") LocalDate fromDate,
                                   @Param("toDate") LocalDate toDate);

    // Admin dashboard: platform-wide aggregations (no owner scoping).

    @Query("SELECT b.status, COUNT(b) FROM Booking b " +
           "WHERE (:fromDate IS NULL OR b.bookingDate >= :fromDate) " +
           "AND (:toDate IS NULL OR b.bookingDate <= :toDate) " +
           "GROUP BY b.status")
    List<Object[]> countByStatusPlatformWide(@Param("fromDate") LocalDate fromDate,
                                              @Param("toDate") LocalDate toDate);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0), COALESCE(SUM(b.commissionAmount), 0) FROM Booking b " +
           "WHERE b.status IN :statuses " +
           "AND (:fromDate IS NULL OR b.bookingDate >= :fromDate) " +
           "AND (:toDate IS NULL OR b.bookingDate <= :toDate)")
    List<Object[]> revenuePlatformWide(@Param("statuses") List<BookingStatus> statuses,
                                        @Param("fromDate") LocalDate fromDate,
                                        @Param("toDate") LocalDate toDate);
}
