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
}
