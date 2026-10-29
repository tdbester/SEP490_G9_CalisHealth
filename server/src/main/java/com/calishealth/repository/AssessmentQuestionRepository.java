package com.calishealth.repository;

import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestion, Long> {
    boolean existsByQuestionCode(String questionCode);

    List<AssessmentQuestion> findByQuestionCodeIn(Collection<String> questionCodes);

    List<AssessmentQuestion> findByStatusOrderByQuestionCodeAsc(ConfigStatus status);
}
