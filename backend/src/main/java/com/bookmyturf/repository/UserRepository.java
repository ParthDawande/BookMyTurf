package com.bookmyturf.repository;

import com.bookmyturf.model.Role;
import com.bookmyturf.model.User;
import com.bookmyturf.model.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    List<User> findByRoleAndStatus(Role role, UserStatus status);
    long countByRoleAndStatus(Role role, UserStatus status);
}
