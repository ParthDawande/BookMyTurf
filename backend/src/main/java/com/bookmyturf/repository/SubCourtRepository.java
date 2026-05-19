package com.bookmyturf.repository;

import com.bookmyturf.model.ListingStatus;
import com.bookmyturf.model.SubCourt;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SubCourtRepository extends JpaRepository<SubCourt, Long> {

    @Query("SELECT sc FROM SubCourt sc WHERE sc.turf.id = :turfId ORDER BY sc.name ASC")
    List<SubCourt> findByTurfIdOrdered(@Param("turfId") Long turfId);

    @Query("SELECT sc FROM SubCourt sc WHERE sc.id = :id AND sc.turf.owner.id = :ownerId")
    Optional<SubCourt> findByIdAndOwnerId(@Param("id") Long id, @Param("ownerId") Long ownerId);

    @Query("SELECT COUNT(sc) FROM SubCourt sc WHERE sc.name = :name AND sc.turf.id = :turfId")
    long countByNameAndTurfId(@Param("name") String name, @Param("turfId") Long turfId);

    @Query("SELECT COUNT(sc) FROM SubCourt sc WHERE sc.name = :name AND sc.turf.id = :turfId AND sc.id != :excludeId")
    long countByNameAndTurfIdExcluding(@Param("name") String name,
                                       @Param("turfId") Long turfId,
                                       @Param("excludeId") Long excludeId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM SubCourt sc WHERE sc.turf.id = :turfId")
    void deleteAllByTurfId(@Param("turfId") Long turfId);

    @Query("SELECT sc FROM SubCourt sc WHERE sc.status = 'PENDING'")
    Page<SubCourt> findAllPending(Pageable pageable);

    @Query("SELECT sc FROM SubCourt sc WHERE sc.status = 'PENDING' AND sc.turf.id = :turfId")
    Page<SubCourt> findAllPendingByTurfId(@Param("turfId") Long turfId, Pageable pageable);

    @Query("SELECT sc FROM SubCourt sc WHERE sc.status = 'PENDING' AND LOWER(sc.turf.city) = LOWER(:city)")
    Page<SubCourt> findAllPendingByCity(@Param("city") String city, Pageable pageable);

    @Query("SELECT sc FROM SubCourt sc WHERE sc.status = 'PENDING' AND sc.turf.id = :turfId AND LOWER(sc.turf.city) = LOWER(:city)")
    Page<SubCourt> findAllPendingByTurfIdAndCity(@Param("turfId") Long turfId, @Param("city") String city, Pageable pageable);

    @Query("SELECT COUNT(sc) FROM SubCourt sc WHERE sc.turf.id = :turfId")
    long countByTurfId(@Param("turfId") Long turfId);

    @Query("SELECT COUNT(sc) FROM SubCourt sc WHERE sc.turf.id = :turfId AND sc.status = :status")
    long countByTurfIdAndStatus(@Param("turfId") Long turfId, @Param("status") ListingStatus status);

    // APPROVED sub-courts for a single turf (customer/public visibility).
    @Query("SELECT sc FROM SubCourt sc WHERE sc.turf.id = :turfId AND sc.status = 'APPROVED' ORDER BY sc.id ASC")
    List<SubCourt> findApprovedByTurfId(@Param("turfId") Long turfId);

    // Batch load APPROVED sub-courts for multiple turfs (used by discovery search to avoid N+1).
    @Query("SELECT sc FROM SubCourt sc WHERE sc.turf.id IN :turfIds AND sc.status = 'APPROVED'")
    List<SubCourt> findApprovedByTurfIdIn(@Param("turfIds") List<Long> turfIds);

    // Booking initiate: find a bookable sub-court (APPROVED + turf APPROVED + owner ACTIVE).
    @Query("SELECT sc FROM SubCourt sc WHERE sc.id = :id AND sc.status = 'APPROVED' " +
           "AND sc.turf.status = 'APPROVED' AND sc.turf.owner.status = 'ACTIVE'")
    Optional<SubCourt> findBookableById(@Param("id") Long id);

    // Booking confirm: acquire a pessimistic WRITE lock on the sub_courts row to serialise
    // concurrent confirms for the same sub-court. Different sub-courts proceed in parallel.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT sc FROM SubCourt sc WHERE sc.id = :id")
    Optional<SubCourt> findByIdForUpdate(@Param("id") Long id);
}
