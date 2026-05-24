package com.bookmyturf.repository;

import com.bookmyturf.model.ComplaintNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ComplaintNoteRepository extends JpaRepository<ComplaintNote, Long> {

    @Query("SELECT cn FROM ComplaintNote cn WHERE cn.complaint.id = :complaintId ORDER BY cn.createdAt ASC")
    List<ComplaintNote> findByComplaintId(@Param("complaintId") Long complaintId);

    @Query("SELECT cn FROM ComplaintNote cn WHERE cn.query.id = :queryId ORDER BY cn.createdAt ASC")
    List<ComplaintNote> findByQueryId(@Param("queryId") Long queryId);
}
