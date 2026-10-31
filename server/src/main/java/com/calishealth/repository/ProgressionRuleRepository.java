package com.calishealth.repository;

import com.calishealth.models.ProgressionRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProgressionRuleRepository extends JpaRepository<ProgressionRule, Long> {
    boolean existsByExercise_IdAndPrerequisiteExercise_Id(Long exerciseId, Long prerequisiteExerciseId);

    /** Các rule mà member mở khóa được khi làm bài {@code prerequisiteExerciseId}. */
    List<ProgressionRule> findAllByPrerequisiteExercise_IdAndStatus(Long prerequisiteExerciseId, String status);
}
