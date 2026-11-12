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

    /**
     * True khi còn một workout HỆ THỐNG đang hoạt động dùng đúng tên này.
     *
     * <p>Dùng để chặn trùng tên giữa các workout do Content Manager quản lý.
     * Workout do member tự tạo ({@code source = 'CUSTOM'}) không tính vào đây
     * vì mỗi member có bộ workout riêng.</p>
     *
     * @param name            tên cần kiểm tra
     * @param excludeWorkoutId id workout đang sửa để bỏ qua, null khi tạo mới
     */
    @Query("""
            SELECT COUNT(w) > 0 FROM WorkoutEntry w
            WHERE UPPER(w.source) = 'SYSTEM'
              AND lower(trim(w.name)) = lower(trim(:name))
              AND (w.moderationStatus IS NULL OR UPPER(w.moderationStatus) <> 'DELETED')
              AND (:excludeId IS NULL OR w.id <> :excludeId)
            """)
    boolean existsActiveSystemByNameIgnoreCase(@Param("name") String name, @Param("excludeId") Long excludeId);

    /**
     * True khi CHÍNH member này đang có workout riêng dùng đúng tên này.
     *
     * <p>Chỉ so trong phạm vi sở hữu: hai member khác nhau được phép đặt cùng
     * tên workout riêng. Ngược lại, một member sẽ không thấy workout của
     * người khác trong "My workouts" nên trùng tên không gây nhầm lẫn.</p>
     *
     * @param authorId        id member sở hữu workout
     * @param name            tên cần kiểm tra
     * @param excludeWorkoutId id workout đang sửa để bỏ qua, null khi tạo mới
     */
    @Query("""
            SELECT COUNT(w) > 0 FROM WorkoutEntry w
            WHERE UPPER(w.source) = 'CUSTOM'
              AND w.createdBy.id = :authorId
              AND lower(trim(w.name)) = lower(trim(:name))
              AND (w.moderationStatus IS NULL OR UPPER(w.moderationStatus) <> 'DELETED')
              AND (:excludeId IS NULL OR w.id <> :excludeId)
            """)
    boolean existsActiveCustomByAuthorAndNameIgnoreCase(
            @Param("authorId") Long authorId,
            @Param("name") String name,
            @Param("excludeId") Long excludeId);

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
