package com.calishealth.repository;

import com.calishealth.models.MuscleGroup;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MuscleGroupRepository extends JpaRepository<MuscleGroup, Long> {
    java.util.Optional<MuscleGroup> findByNameIgnoreCase(String name);
}
