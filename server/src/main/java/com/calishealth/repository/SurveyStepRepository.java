package com.calishealth.repository;

import com.calishealth.models.SurveyStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SurveyStepRepository extends JpaRepository<SurveyStep, Long> {
    List<SurveyStep> findBySurveyIdOrderBySortOrderAsc(Long surveyId);

    Optional<SurveyStep> findBySurveyIdAndStepTypeAndStatus(Long surveyId, SurveyStep.Type stepType,
            SurveyStep.Status status);
}
