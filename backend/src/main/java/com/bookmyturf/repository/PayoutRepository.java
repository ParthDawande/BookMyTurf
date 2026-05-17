package com.bookmyturf.repository;

import com.bookmyturf.model.Payout;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayoutRepository extends JpaRepository<Payout, Long> {
}
