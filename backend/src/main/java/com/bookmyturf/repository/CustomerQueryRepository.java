package com.bookmyturf.repository;

import com.bookmyturf.model.CustomerQuery;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerQueryRepository extends JpaRepository<CustomerQuery, Long> {
}
