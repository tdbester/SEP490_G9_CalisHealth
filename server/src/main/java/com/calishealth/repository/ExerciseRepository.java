package com.calishealth.repository;

import com.calishealth.models.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExerciseRepository extends JpaRepository<Exercise, Long>, JpaSpecificationExecutor<Exercise> {
    Optional<Exercise> findByCode(String code);
    boolean existsByCode(String code);
    List<Exercise> findAllByCodeIn(List<String> codes);
    Optional<Exercise> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndSource(String name, String source);

    /**
     * True when a (not soft-deleted) exercise already uses this exact title.
     * So sánh không phân biệt hoa thường và bỏ khoảng trắng thừa ở hai đầu.
     */
    @Query("select count(e) > 0 from Exercise e where lower(trim(e.name)) = lower(trim(:name)) "
            + "and (e.moderationStatus is null or upper(e.moderationStatus) <> 'DELETED')")
    boolean existsNotDeletedByNameIgnoreCase(@Param("name") String name);

    /** Cùng trên nhưng bỏ qua chính bài đang sửa (id = -1 khi tạo mới). */
    @Query("select count(e) > 0 from Exercise e where e.id <> :id "
            + "and lower(trim(e.name)) = lower(trim(:name)) "
            + "and (e.moderationStatus is null or upper(e.moderationStatus) <> 'DELETED')")
    boolean existsOtherNotDeletedByNameIgnoreCase(@Param("id") Long id, @Param("name") String name);
    Optional<Exercise> findByIdAndCreatedBy_IdAndSource(Long id, Long authorId, String source);
    @Query("""
            SELECT e FROM Exercise e
            WHERE e.id = :id AND e.source = :source
              AND UPPER(e.moderationStatus) IN ('ACTIVE', 'ACCEPTED')
            """)
    Optional<Exercise> findAcceptedByIdAndSource(
            @Param("id") Long id,
            @Param("source") String source);

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.type = :type AND e.source = 'SYSTEM'
              AND UPPER(e.moderationStatus) IN ('ACTIVE', 'ACCEPTED')
              AND e.active = true
            """)
    long countAcceptedSystemExercisesByType(@Param("type") String type);

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.createdBy.id = :authorId AND e.source = 'CUSTOM'
              AND UPPER(e.moderationStatus) IN ('ACTIVE', 'ACCEPTED')
            """)
    long countAcceptedMemberExercisesByAuthorId(@Param("authorId") Long authorId);

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.source = 'CUSTOM' AND e.active = true AND e.shareWithCommunity = true
              AND UPPER(e.moderationStatus) IN ('ACTIVE', 'ACCEPTED')
            """)
    long countPublishedCommunityMemberExercises();

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.createdBy.id = :authorId AND e.source = :source
              AND UPPER(e.moderationStatus) IN :statuses
            """)
    long countByAuthorAndSourceAndModerationStatuses(
            @Param("authorId") Long authorId,
            @Param("source") String source,
            @Param("statuses") List<String> statuses);

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.source IN ('MEMBER', 'CUSTOM') AND e.createdBy.email = :email
            """)
    long countMemberExercisesByEmail(String email);

    @Query("""
            SELECT e FROM Exercise e
            WHERE e.source IN ('MEMBER', 'CUSTOM') AND e.createdBy.email = :email
            """)
    List<Exercise> findMemberExercisesByEmail(String email);

    /** True when a (not soft-deleted) exercise is still tagged with this level name. */
    @Query("select count(e) > 0 from Exercise e where lower(e.difficultyLevel) = lower(:level) "
            + "and (e.moderationStatus is null or upper(e.moderationStatus) <> 'DELETED')")
    boolean existsInUseByDifficultyLevel(@Param("level") String level);

    /** Moderation status of every exercise that uses this video or anatomy image. */
    @Query("select coalesce(e.moderationStatus, 'ACTIVE') from Exercise e where e.videoUrl = :url or e.anatomyImageUrl = :url")
    List<String> findModerationStatusesUsingMedia(@Param("url") String url);

    /** [videoUrl, anatomyImageUrl, moderationStatus, creator id] of every exercise that has media. */
    @Query("select e.videoUrl, e.anatomyImageUrl, coalesce(e.moderationStatus, 'ACTIVE'), u.id from Exercise e "
            + "left join e.createdBy u where e.videoUrl is not null or e.anatomyImageUrl is not null")
    List<Object[]> findMediaReferences();
}
