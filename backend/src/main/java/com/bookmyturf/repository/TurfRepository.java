package com.bookmyturf.repository;

import com.bookmyturf.model.ListingStatus;
import com.bookmyturf.model.Turf;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TurfRepository extends JpaRepository<Turf, Long> {

    @Query("SELECT t FROM Turf t WHERE t.id = :id AND t.owner.id = :ownerId")
    Optional<Turf> findByIdAndOwnerId(@Param("id") Long id, @Param("ownerId") Long ownerId);

    @Query("SELECT t FROM Turf t WHERE t.owner.id = :ownerId")
    Page<Turf> findAllByOwnerId(@Param("ownerId") Long ownerId, Pageable pageable);

    @Query("SELECT t FROM Turf t WHERE t.owner.id = :ownerId AND t.status = :status")
    Page<Turf> findAllByOwnerIdAndStatus(@Param("ownerId") Long ownerId,
                                         @Param("status") ListingStatus status,
                                         Pageable pageable);

    @Query("SELECT t FROM Turf t WHERE t.status = 'PENDING'")
    Page<Turf> findAllPending(Pageable pageable);

    @Query("SELECT t FROM Turf t WHERE t.status = 'PENDING' AND LOWER(t.city) = LOWER(:city)")
    Page<Turf> findAllPendingByCity(@Param("city") String city, Pageable pageable);
}
