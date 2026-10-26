package com.calishealth.repository;

import com.calishealth.models.LevelRuleBand;
import com.calishealth.models.LevelRuleCriterion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LevelRuleCriterionRepository extends JpaRepository<LevelRuleCriterion, Long> {
    List<LevelRuleCriterion> findByRuleSetIdOrderBySortOrderAsc(Long ruleSetId);

    /** Mọi khoảng giá trị của 1 bộ luật trong 1 query (tránh N+1 theo tiêu chí). */
    @Query("""
            select b from LevelRuleBand b
            join fetch b.criterion c
            left join fetch b.fitnessLevel
            where c.ruleSet.id = :ruleSetId
            order by c.sortOrder, b.sortOrder
            """)
    List<LevelRuleBand> findBandsByRuleSetId(@Param("ruleSetId") Long ruleSetId);
}
