package com.calishealth.repository;

import com.calishealth.models.AssessmentQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestion, Long> {
    boolean existsByQuestionCode(String questionCode);
}
