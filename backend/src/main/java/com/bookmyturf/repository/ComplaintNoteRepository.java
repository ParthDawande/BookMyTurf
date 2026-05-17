package com.bookmyturf.repository;

import com.bookmyturf.model.ComplaintNote;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComplaintNoteRepository extends JpaRepository<ComplaintNote, Long> {
}
