package com.calishealth.repository;

import com.calishealth.models.SurveyStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SurveyStepRepository extends JpaRepository<SurveyStep, Long> {
    List<SurveyStep> findBySurveyIdOrderBySortOrderAsc(Long surveyId);
}
