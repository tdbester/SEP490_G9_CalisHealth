package com.calishealth.repository;

import com.calishealth.models.ProgressionRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;

public interface ProgressionRuleRepository extends JpaRepository<ProgressionRule, Long> {
    boolean existsByExercise_IdAndPrerequisiteExercise_Id(Long exerciseId, Long prerequisiteExerciseId);

    @EntityGraph(attributePaths = {"exercise", "prerequisiteExercise"})
    List<ProgressionRule> findAllByStatus(String status);

    @EntityGraph(attributePaths = {"exercise", "prerequisiteExercise"})
    List<ProgressionRule> findAllByOrderByIdAsc();

    /** Các rule mà member mở khóa được khi làm bài {@code prerequisiteExerciseId}. */
    List<ProgressionRule> findAllByPrerequisiteExercise_IdAndStatus(Long prerequisiteExerciseId, String status);
}
