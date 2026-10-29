package com.calishealth.repository;

import com.calishealth.models.FitnessLevel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FitnessLevelRepository extends JpaRepository<FitnessLevel, Long> {
    Optional<FitnessLevel> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
}
