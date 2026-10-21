package com.calishealth.repository;

import com.calishealth.models.ExerciseEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExerciseRepository extends JpaRepository<ExerciseEntry, Long> {
    Optional<ExerciseEntry> findByCode(String code);
    boolean existsByCode(String code);
    List<ExerciseEntry> findAllByCodeIn(List<String> codes);
}
