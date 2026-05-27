package com.bookmyturf.repository;

import com.bookmyturf.model.Complaint;
import com.bookmyturf.model.SupportTicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {

    @Query("SELECT c FROM Complaint c WHERE c.customer.id = :customerId ORDER BY c.createdAt DESC")
    Page<Complaint> findByCustomerId(@Param("customerId") Long customerId, Pageable pageable);

    @Query("SELECT c FROM Complaint c WHERE c.status = :status ORDER BY c.createdAt DESC")
    Page<Complaint> findByStatus(@Param("status") SupportTicketStatus status, Pageable pageable);

    @Query("SELECT c FROM Complaint c ORDER BY c.createdAt DESC")
    Page<Complaint> findAllPaged(Pageable pageable);

    @Query("SELECT c FROM Complaint c WHERE c.assignedStaff.id = :staffId ORDER BY c.createdAt DESC")
    List<Complaint> findByAssignedStaffId(@Param("staffId") Long staffId);

    // Admin dashboard: count of complaints in the active operational queue (snapshot, no date filter).
    @Query("SELECT COUNT(c) FROM Complaint c WHERE c.status IN :statuses")
    long countByStatusIn(@Param("statuses") List<SupportTicketStatus> statuses);
}
