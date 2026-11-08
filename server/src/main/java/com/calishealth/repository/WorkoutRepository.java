package com.calishealth.repository;

import com.calishealth.models.WorkoutEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
