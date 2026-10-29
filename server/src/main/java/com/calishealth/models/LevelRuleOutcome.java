package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Điểm tổng >= minScore -> fitness level; sortOrder là thứ hạng level (1 = thấp nhất). */
@Entity
@Table(name = "level_rule_outcomes")
@Getter
@Setter
@NoArgsConstructor
public class LevelRuleOutcome {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_set_id", nullable = false)
    private LevelRuleSet ruleSet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fitness_level_id", nullable = false)
    private FitnessLevel fitnessLevel;

    @Column(name = "min_score", nullable = false, precision = 8, scale = 3)
    private BigDecimal minScore;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(columnDefinition = "TEXT")
    private String summary;

    /** JSON thô của SurveyDtos.Recommendation (kế hoạch gợi ý cho level này). */
    @Column(columnDefinition = "json")
    private String recommendation;
}
