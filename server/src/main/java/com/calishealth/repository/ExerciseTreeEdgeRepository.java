package com.calishealth.repository;

import com.calishealth.models.ExerciseTreeEdge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ExerciseTreeEdgeRepository extends JpaRepository<ExerciseTreeEdge, Long> {
    @Query("""
            select edge from ExerciseTreeEdge edge
            where edge.parentExerciseId in :exerciseIds
               or edge.childExerciseId in :exerciseIds
            """)
    List<ExerciseTreeEdge> findAllConnectedTo(@Param("exerciseIds") Collection<Long> exerciseIds);
}
