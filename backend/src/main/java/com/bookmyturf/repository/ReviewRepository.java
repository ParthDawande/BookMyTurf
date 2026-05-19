package com.bookmyturf.repository;

import com.bookmyturf.model.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    @Query("SELECT r FROM Review r WHERE r.turf.id = :turfId ORDER BY r.createdAt DESC")
    Page<Review> findRecentByTurfId(@Param("turfId") Long turfId, Pageable pageable);
}
