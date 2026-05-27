package com.bookmyturf.repository;

import com.bookmyturf.model.ListingStatus;
import com.bookmyturf.model.Turf;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
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

    // Customer/public discovery: APPROVED turfs where owner is ACTIVE and at least one APPROVED sub-court exists.
    @Query("SELECT DISTINCT t FROM Turf t WHERE t.status = 'APPROVED' AND t.owner.status = 'ACTIVE' " +
           "AND EXISTS (SELECT sc FROM SubCourt sc WHERE sc.turf = t AND sc.status = 'APPROVED')")
    List<Turf> findAllDiscoverable();

    // Single discoverable turf by id (no sub-court existence check — done separately).
    @Query("SELECT t FROM Turf t WHERE t.id = :id AND t.status = 'APPROVED' AND t.owner.status = 'ACTIVE'")
    Optional<Turf> findDiscoverableById(@Param("id") Long id);

    // Admin dashboard: current snapshot count of turfs awaiting approval.
    @Query("SELECT COUNT(t) FROM Turf t WHERE t.status = 'PENDING'")
    long countPending();

    // Cities with APPROVED-turf count for the public /cities endpoint.
    // Returns Object[] rows: [city (String), count (Number)].
    @Query(value = "SELECT t.city, COUNT(t.id) FROM turfs t " +
                   "JOIN users u ON t.owner_id = u.id " +
                   "WHERE t.status = 'APPROVED' AND u.status = 'ACTIVE' " +
                   "GROUP BY t.city ORDER BY COUNT(t.id) DESC, t.city ASC",
           nativeQuery = true)
    List<Object[]> findCitiesWithCount();
}
