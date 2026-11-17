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

    /**
     * Mọi rule liên quan tới một bài: bài là ĐÍCH (bài này mở khoá bài khác) hoặc bài là
     * TIỀN KIỆN (làm bài này thì mở khoá bài khác).
     *
     * <p>V83 bỏ bảng `exercise_tree_edges` nên đây là nguồn duy nhất để dựng danh sách
     * "bài trước / bài sau" ở màn chi tiết bài tập.
     */
    @EntityGraph(attributePaths = {"exercise", "prerequisiteExercise"})
    List<ProgressionRule> findAllByExercise_IdOrPrerequisiteExercise_Id(Long exerciseId, Long prerequisiteExerciseId);
}
