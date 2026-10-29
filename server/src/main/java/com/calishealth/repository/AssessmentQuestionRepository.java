package com.calishealth.repository;

import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestion, Long> {
    boolean existsByQuestionCode(String questionCode);

    Optional<AssessmentQuestion> findByQuestionCode(String questionCode);

    List<AssessmentQuestion> findAllByQuestionTypeIgnoreCaseAndStatus(String questionType, ConfigStatus status);

    List<AssessmentQuestion> findByQuestionCodeIn(Collection<String> questionCodes);

    List<AssessmentQuestion> findByStatusOrderByQuestionCodeAsc(ConfigStatus status);
}
