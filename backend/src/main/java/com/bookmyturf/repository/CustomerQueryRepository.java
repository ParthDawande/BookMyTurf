package com.bookmyturf.repository;

import com.bookmyturf.model.CustomerQuery;
import com.bookmyturf.model.SupportTicketStatus;
import com.bookmyturf.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CustomerQueryRepository extends JpaRepository<CustomerQuery, Long> {

    @Query("SELECT q FROM CustomerQuery q WHERE q.customer.id = :customerId ORDER BY q.createdAt DESC")
    Page<CustomerQuery> findByCustomerId(@Param("customerId") Long customerId, Pageable pageable);

    @Query("SELECT q FROM CustomerQuery q WHERE q.status = :status ORDER BY q.createdAt ASC")
    Page<CustomerQuery> findByStatus(@Param("status") SupportTicketStatus status, Pageable pageable);

    @Query("SELECT q FROM CustomerQuery q ORDER BY q.createdAt DESC")
    Page<CustomerQuery> findAllPaged(Pageable pageable);

    @Query("SELECT q FROM CustomerQuery q WHERE q.status = 'OPEN' ORDER BY q.createdAt ASC")
    List<CustomerQuery> findOpenQueries();

    @Query("SELECT q FROM CustomerQuery q WHERE q.pickedUpByStaff.id = :staffId ORDER BY q.createdAt DESC")
    List<CustomerQuery> findByPickedUpByStaffId(@Param("staffId") Long staffId);

    // Admin dashboard: count of queries in the active operational queue (snapshot, no date filter).
    @Query("SELECT COUNT(q) FROM CustomerQuery q WHERE q.status IN :statuses")
    long countByStatusIn(@Param("statuses") List<SupportTicketStatus> statuses);

    // Atomic claim: UPDATE ... WHERE id = :id AND status = OPEN.
    // Returns 1 if this transaction won the race; 0 if the row was already claimed.
    @Modifying(clearAutomatically = true)
    @Query("UPDATE CustomerQuery q SET q.status = :inProgress, q.pickedUpByStaff = :staff WHERE q.id = :id AND q.status = :open")
    int claimQuery(@Param("id") Long id,
                   @Param("staff") User staff,
                   @Param("open") SupportTicketStatus open,
                   @Param("inProgress") SupportTicketStatus inProgress);
}
