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

    /**
     * Các rule của mọi bài tập thuộc một nhóm chuyển động — nguồn dữ liệu để
     * tính gợi ý ngưỡng cho member khi tạo bài custom.
     *
     * <p>Chỉ lấy bài đang hoạt động để số liệu gợi ý phản ánh các ngưỡng đang
     * thực sự được áp dụng.
     */
    @Query("""
            SELECT fr FROM FormRule fr
            JOIN fr.exercise e
            WHERE e.movementGroup = :movementGroup
              AND e.active = true
              AND (:category IS NULL OR e.category = :category)
            ORDER BY fr.joint, fr.id
            """)
    List<FormRule> findByMovementGroup(
            @Param("movementGroup") String movementGroup,
            @Param("category") String category);

    /** Xoá toàn bộ rule của một bài tập (dùng khi khai báo lại từ đầu). */
    void deleteByExerciseId(Long exerciseId);
}
