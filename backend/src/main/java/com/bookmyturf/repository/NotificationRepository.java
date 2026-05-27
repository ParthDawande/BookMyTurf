package com.bookmyturf.repository;

import com.bookmyturf.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @Query(value = "SELECT * FROM notifications WHERE user_id = :userId ORDER BY created_at DESC",
           countQuery = "SELECT COUNT(*) FROM notifications WHERE user_id = :userId",
           nativeQuery = true)
    Page<Notification> findByUserId(@Param("userId") Long userId, Pageable pageable);

    @Query(value = "SELECT * FROM notifications WHERE user_id = :userId AND is_read = 1 ORDER BY created_at DESC",
           countQuery = "SELECT COUNT(*) FROM notifications WHERE user_id = :userId AND is_read = 1",
           nativeQuery = true)
    Page<Notification> findByUserIdAndRead(@Param("userId") Long userId, Pageable pageable);

    @Query(value = "SELECT * FROM notifications WHERE user_id = :userId AND is_read = 0 ORDER BY created_at DESC",
           countQuery = "SELECT COUNT(*) FROM notifications WHERE user_id = :userId AND is_read = 0",
           nativeQuery = true)
    Page<Notification> findByUserIdAndUnread(@Param("userId") Long userId, Pageable pageable);

    // Ownership check used after an atomic UPDATE returns 0 rows, to distinguish
    // already-read (200 idempotent) from not-found/wrong-user (404).
    @Query("SELECT n FROM Notification n WHERE n.id = :id AND n.user.id = :userId")
    Optional<Notification> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    // Atomic mark-one-read: only fires if is_read=false, so already-read returns 0 rows.
    // clearAutomatically flushes the EntityManager so the subsequent SELECT gets fresh DB state.
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = :now WHERE n.id = :id AND n.user.id = :userId AND n.isRead = false")
    int markOneRead(@Param("id") Long id,
                    @Param("userId") Long userId,
                    @Param("now") LocalDateTime now);

    // Bulk mark-all-read: returns count of rows flipped from unread to read.
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = :now WHERE n.user.id = :userId AND n.isRead = false")
    int markAllRead(@Param("userId") Long userId, @Param("now") LocalDateTime now);
}
