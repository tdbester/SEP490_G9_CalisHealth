package com.calishealth.repository;

import com.calishealth.models.AssessmentAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AssessmentAnswerRepository extends JpaRepository<AssessmentAnswer, Long> {
    @Query("select a from AssessmentAnswer a join fetch a.question where a.session.id = :sessionId")
    List<AssessmentAnswer> findBySessionId(@Param("sessionId") Long sessionId);
}
