package com.calishealth.repository;

import com.calishealth.models.SurveyLevelResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SurveyLevelResultRepository extends JpaRepository<SurveyLevelResult, Long> {
    Optional<SurveyLevelResult> findBySessionId(Long sessionId);
}
