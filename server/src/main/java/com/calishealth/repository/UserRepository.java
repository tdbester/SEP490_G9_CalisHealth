package com.calishealth.repository;

import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    long countByEnabledAndBlocked(boolean enabled, boolean blocked);
    long countByRole(UserRole role);
}
