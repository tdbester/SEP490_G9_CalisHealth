package com.calishealth.repository;

import com.calishealth.models.WorkoutEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WorkoutRepository extends JpaRepository<WorkoutEntry, Long> {
    Optional<WorkoutEntry> findByCode(String code);
    long countByActive(boolean active);
}
