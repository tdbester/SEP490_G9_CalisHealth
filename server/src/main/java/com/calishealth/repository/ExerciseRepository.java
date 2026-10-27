package com.calishealth.repository;

import com.calishealth.models.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExerciseRepository extends JpaRepository<Exercise, Long> {
    Optional<Exercise> findByCode(String code);
    boolean existsByCode(String code);
    List<Exercise> findAllByCodeIn(List<String> codes);
    Optional<Exercise> findByNameIgnoreCase(String name);
}
