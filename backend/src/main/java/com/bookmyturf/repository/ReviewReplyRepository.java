package com.bookmyturf.repository;

import com.bookmyturf.model.ReviewReply;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewReplyRepository extends JpaRepository<ReviewReply, Long> {

    @Query("SELECT rr FROM ReviewReply rr WHERE rr.review.id = :reviewId")
    Optional<ReviewReply> findByReviewId(@Param("reviewId") Long reviewId);

    // Batch load replies for a list of review IDs — used by owner list to avoid N+1.
    @Query("SELECT rr FROM ReviewReply rr WHERE rr.review.id IN :reviewIds")
    List<ReviewReply> findByReviewIdIn(@Param("reviewIds") List<Long> reviewIds);

    // Bulk DELETE bypasses orphanRemoval conflict on Review.reply (CascadeType.ALL parent).
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM ReviewReply rr WHERE rr.id = :id")
    void deleteByReplyId(@Param("id") Long id);
}
