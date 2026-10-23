package com.calishealth.repository;

import com.calishealth.models.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ErdExerciseRepository extends JpaRepository<Exercise, Long> {
    long countBySourceAndType(String source, String type);

    @Query("""
            SELECT COUNT(e) FROM Exercise e
            WHERE e.source = 'MEMBER' AND e.createdBy.id = :authorId AND e.status = 'ACCEPTED'
            """)
    long countAcceptedMemberExercisesByAuthorId(@Param("authorId") Long authorId);

    @Query("SELECT COUNT(e) FROM Exercise e WHERE e.source = 'MEMBER' AND e.createdBy.email = :email")
    long countMemberExercises(@Param("email") String email);

    @Query("SELECT e FROM Exercise e WHERE e.source = 'MEMBER' AND e.createdBy.email = :email")
    java.util.List<Exercise> findMemberExercises(@Param("email") String email);
}
