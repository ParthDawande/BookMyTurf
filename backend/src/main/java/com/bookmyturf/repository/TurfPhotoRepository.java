package com.bookmyturf.repository;

import com.bookmyturf.model.TurfPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TurfPhotoRepository extends JpaRepository<TurfPhoto, Long> {

    @Query("SELECT p FROM TurfPhoto p WHERE p.turf.id = :turfId ORDER BY p.id ASC")
    List<TurfPhoto> findByTurfIdOrdered(@Param("turfId") Long turfId);

    @Query("SELECT p FROM TurfPhoto p WHERE p.id = :id AND p.turf.id = :turfId AND p.turf.owner.id = :ownerId")
    Optional<TurfPhoto> findByIdAndTurfIdAndOwnerId(@Param("id") Long id,
                                                    @Param("turfId") Long turfId,
                                                    @Param("ownerId") Long ownerId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM TurfPhoto p WHERE p.turf.id = :turfId")
    void deleteAllByTurfId(@Param("turfId") Long turfId);
}
