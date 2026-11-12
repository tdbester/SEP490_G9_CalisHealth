package com.calishealth.repository;

import com.calishealth.models.WorkoutEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;

public interface WorkoutRepository extends JpaRepository<WorkoutEntry, Long>, JpaSpecificationExecutor<WorkoutEntry> {
    Optional<WorkoutEntry> findByCode(String code);
    long countByTemplateStatus(String templateStatus);

    @Query("""
            SELECT COUNT(w) FROM WorkoutEntry w
            WHERE w.source = 'SYSTEM' AND w.templateStatus = 'PUBLISHED' AND w.moderationStatus = 'ACTIVE'
              AND UPPER(w.type) = UPPER(:type)
            """)
    long countSystemWorkoutsByType(@Param("type") String type);

    /**
     * Đếm workout hệ thống theo nhiều loại.
     *
     * Dùng cho Library: workout loại FLEX hiển thị ở CẢ tab Health và tab Skill
     * nên số liệu tổng quan cũng phải tính FLEX vào cả hai bên.
     */
    @Query("""
            SELECT COUNT(w) FROM WorkoutEntry w
            WHERE w.source = 'SYSTEM' AND w.templateStatus = 'PUBLISHED' AND w.moderationStatus = 'ACTIVE'
              AND UPPER(w.type) IN :types
            """)
    long countSystemWorkoutsByTypes(@Param("types") Collection<String> types);

    /**
     * True khi còn workout đang hoạt động dùng đúng tên này.
     *
     * So sánh không phân biệt hoa thường và bỏ khoảng trắng thừa ở hai đầu.
     * Dùng để chặn tên workout trùng với tên bài tập (và ngược lại).
     *
     * @param name            tên cần kiểm tra
     * @param excludeWorkoutId id workout đang sửa để bỏ qua, null khi tạo mới
     */
    @Query("""
            SELECT COUNT(w) > 0 FROM WorkoutEntry w
            WHERE lower(trim(w.name)) = lower(trim(:name))
              AND (w.moderationStatus IS NULL OR UPPER(w.moderationStatus) <> 'DELETED')
              AND (:excludeId IS NULL OR w.id <> :excludeId)
            """)
    boolean existsActiveByNameIgnoreCase(@Param("name") String name, @Param("excludeId") Long excludeId);

    @Query("""
            SELECT COUNT(w) FROM WorkoutEntry w
            WHERE w.source = 'CUSTOM' AND w.createdBy.id = :authorId
            """)
    long countCustomWorkoutsByAuthorId(@Param("authorId") Long authorId);

    /** Community workout count: published, accepted workouts shared by members. */
    long countBySourceAndTemplateStatusAndModerationStatusAndSharedWithCommunityTrue(
            String source, String templateStatus, String moderationStatus);
    boolean existsByLevelIgnoreCase(String level);
}
