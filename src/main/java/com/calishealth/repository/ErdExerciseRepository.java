package com.calishealth.repository;

import com.calishealth.models.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ErdExerciseRepository extends JpaRepository<Exercise, Long> {
}
