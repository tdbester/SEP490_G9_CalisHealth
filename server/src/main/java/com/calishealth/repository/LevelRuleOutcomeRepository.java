package com.calishealth.repository;

import com.calishealth.models.LevelRuleOutcome;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LevelRuleOutcomeRepository extends JpaRepository<LevelRuleOutcome, Long> {
    @Query("""
            select o from LevelRuleOutcome o
            join fetch o.fitnessLevel
            where o.ruleSet.id = :ruleSetId
            order by o.sortOrder
            """)
    List<LevelRuleOutcome> findByRuleSetId(@Param("ruleSetId") Long ruleSetId);
}
