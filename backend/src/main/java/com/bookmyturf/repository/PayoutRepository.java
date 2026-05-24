package com.bookmyturf.repository;

import com.bookmyturf.model.Payout;
import com.bookmyturf.model.PayoutStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PayoutRepository extends JpaRepository<Payout, Long> {

    @Query("SELECT p FROM Payout p WHERE p.booking.id = :bookingId")
    Optional<Payout> findByBookingId(@Param("bookingId") Long bookingId);

    // Eligible for release: PENDING and scheduled_at <= now.
    // Uses a native query so MySQL's server-side comparison (UTC_TIMESTAMP() via session timezone)
    // avoids JDBC LocalDateTime parameter conversion artifacts.
    @Query(value = "SELECT * FROM payouts WHERE status = 'PENDING' AND scheduled_at <= UTC_TIMESTAMP()", nativeQuery = true)
    List<Payout> findEligible();

    // Per-payout SELECT FOR UPDATE — must be called within an active transaction.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payout p WHERE p.id = :id")
    Optional<Payout> findByIdForUpdate(@Param("id") Long id);

    // Owner-scoped queries — all ordered scheduled_at DESC.
    @Query("SELECT p FROM Payout p WHERE p.owner.id = :ownerId ORDER BY p.scheduledAt DESC")
    Page<Payout> findByOwnerId(@Param("ownerId") Long ownerId, Pageable pageable);

    @Query("SELECT p FROM Payout p WHERE p.owner.id = :ownerId AND p.status = :status ORDER BY p.scheduledAt DESC")
    Page<Payout> findByOwnerIdAndStatus(@Param("ownerId") Long ownerId, @Param("status") PayoutStatus status, Pageable pageable);

    @Query("SELECT p FROM Payout p WHERE p.owner.id = :ownerId AND p.scheduledAt >= :from AND p.scheduledAt <= :to ORDER BY p.scheduledAt DESC")
    Page<Payout> findByOwnerIdAndDateRange(@Param("ownerId") Long ownerId, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to, Pageable pageable);

    @Query("SELECT p FROM Payout p WHERE p.owner.id = :ownerId AND p.status = :status AND p.scheduledAt >= :from AND p.scheduledAt <= :to ORDER BY p.scheduledAt DESC")
    Page<Payout> findByOwnerIdAndStatusAndDateRange(@Param("ownerId") Long ownerId, @Param("status") PayoutStatus status, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to, Pageable pageable);
}
