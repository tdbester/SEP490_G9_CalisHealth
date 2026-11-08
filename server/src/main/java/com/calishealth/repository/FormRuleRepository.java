package com.calishealth.repository;

import com.calishealth.models.FormRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FormRuleRepository extends JpaRepository<FormRule, Long> {

    /** Các rule form của một bài tập, dùng cho màn AI Pose Tracking. */
    @Query("""
            SELECT fr FROM FormRule fr
            JOIN fr.exercise e
            WHERE e.code = :code
            ORDER BY fr.id
            """)
    List<FormRule> findByExerciseCode(@Param("code") String code);
}
