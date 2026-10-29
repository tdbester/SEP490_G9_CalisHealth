package com.calishealth.repository;

import com.calishealth.models.LevelRuleSet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LevelRuleSetRepository extends JpaRepository<LevelRuleSet, Long> {
    Optional<LevelRuleSet> findBySurveyCodeAndStatus(String surveyCode, LevelRuleSet.Status status);

    List<LevelRuleSet> findByStatus(LevelRuleSet.Status status);
}
