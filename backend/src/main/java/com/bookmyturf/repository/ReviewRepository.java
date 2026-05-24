package com.bookmyturf.repository;

import com.bookmyturf.model.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    @Query("SELECT r FROM Review r WHERE r.turf.id = :turfId ORDER BY r.createdAt DESC")
    Page<Review> findRecentByTurfId(@Param("turfId") Long turfId, Pageable pageable);

    @Query("SELECT r FROM Review r WHERE r.booking.id = :bookingId")
    Optional<Review> findByBookingId(@Param("bookingId") Long bookingId);

    // Returns [AVG(rating), COUNT(*)]. AVG is null when count = 0 — handle in service.
    @Query("SELECT AVG(r.rating), COUNT(r) FROM Review r WHERE r.turf.id = :turfId")
    List<Object[]> computeAggregateByTurfId(@Param("turfId") Long turfId);

    // Owner list: all reviews across owner's turfs (in-service Java filtering applied after).
    @Query("SELECT r FROM Review r WHERE r.turf.owner.id = :ownerId")
    List<Review> findAllForOwner(@Param("ownerId") Long ownerId);

    // Owner list filtered to a specific turf (ownership of turf verified in service before call).
    @Query("SELECT r FROM Review r WHERE r.turf.owner.id = :ownerId AND r.turf.id = :turfId")
    List<Review> findAllForOwnerByTurf(@Param("ownerId") Long ownerId, @Param("turfId") Long turfId);
}
