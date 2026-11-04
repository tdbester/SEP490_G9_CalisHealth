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
    Optional<Exercise> findByIdAndSourceAndStatus(Long id, String source, String status);
    long countByTypeAndSourceAndStatus(String type, String source, String status);
    /** Library counts only ever show published (active) rows, so the flag is part of the derived query. */
    long countByTypeAndSourceAndActiveTrueAndStatus(String type, String source, String status);
    /** Community exercise count: published, accepted rows shared by members. */
    long countBySourceAndActiveTrueAndStatusAndShareWithCommunityTrue(String source, String status);
    long countByCreatedBy_IdAndSourceAndStatus(Long authorId, String source, String status);
    Optional<Exercise> findByIdAndCreatedBy_IdAndSource(Long id, Long authorId, String source);
    List<Exercise> findAllByMovementGroupAndSourceAndStatus(
            Exercise.MovementGroup movementGroup,
            String source,
            String status);

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

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.source = 'SYSTEM' AND e.status = 'ACCEPTED' AND e.type = :type
            """)
    long countAcceptedSystemExercisesByType(String type);

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.createdBy.id = :authorId AND e.source = 'CUSTOM'
              AND e.status = 'ACCEPTED'
            """)
    long countAcceptedMemberExercisesByAuthorId(Long authorId);

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
