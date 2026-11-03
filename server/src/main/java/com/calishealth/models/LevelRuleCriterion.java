package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** 1 tiêu chí chấm level = 1 câu hỏi NUMBER của survey (vd PUSH_UP_MAX_REPS) kèm trọng số. */
@Entity
@Table(name = "level_rule_criteria")
@Getter
@Setter
@NoArgsConstructor
public class LevelRuleCriterion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rule_set_id", nullable = false)
    private LevelRuleSet ruleSet;

    @Column(name = "criterion_code", nullable = false, length = 64)
    private String criterionCode;

    @Column(nullable = false)
    private String label;

    @Column(name = "question_code", nullable = false, length = 64)
    private String questionCode;

    @Column(nullable = false, precision = 8, scale = 3)
    private BigDecimal weight = BigDecimal.ONE;

    /** true: thiếu câu trả lời thì không chấm được (dùng level dự phòng); false: bỏ tiêu chí khỏi phép tính. */
    @Column(nullable = false)
    private boolean required = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
