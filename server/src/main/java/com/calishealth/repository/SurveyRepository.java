package com.calishealth.repository;

import com.calishealth.models.Survey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SurveyRepository extends JpaRepository<Survey, Long> {
    Optional<Survey> findBySurveyCodeAndStatus(String surveyCode, Survey.Status status);
    Optional<Survey> findBySurveyCodeAndVersion(String surveyCode, int version);
    List<Survey> findByStatus(Survey.Status status);
    boolean existsBySurveyCode(String surveyCode);
}
