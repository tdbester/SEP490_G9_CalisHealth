package com.calishealth.repository;

import com.calishealth.models.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ErdExerciseRepository extends JpaRepository<Exercise, Long> {
    long countBySourceAndType(String source, String type);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(e) FROM Exercise e WHERE e.source = 'MEMBER' AND e.createdBy.email = :email")
    long countMemberExercises(@org.springframework.data.repository.query.Param("email") String email);

    @org.springframework.data.jpa.repository.Query("SELECT e FROM Exercise e WHERE e.source = 'MEMBER' AND e.createdBy.email = :email")
    java.util.List<Exercise> findMemberExercises(@org.springframework.data.repository.query.Param("email") String email);
}
