package com.calishealth.repository;

import com.calishealth.models.WorkoutEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface WorkoutRepository extends JpaRepository<WorkoutEntry, Long>, JpaSpecificationExecutor<WorkoutEntry> {
    Optional<WorkoutEntry> findByCode(String code);
    long countByActive(boolean active);

    @Query("""
            SELECT COUNT(w) FROM WorkoutEntry w
            WHERE w.isSystem = true AND UPPER(w.type) = UPPER(:type)
            """)
    long countSystemWorkoutsByType(@Param("type") String type);

    @Query("""
            SELECT COUNT(w) FROM WorkoutEntry w
            WHERE w.isSystem = false AND w.authorId = :authorId AND UPPER(w.type) = 'CUSTOM'
            """)
    long countCustomWorkoutsByAuthorId(@Param("authorId") Long authorId);
}
