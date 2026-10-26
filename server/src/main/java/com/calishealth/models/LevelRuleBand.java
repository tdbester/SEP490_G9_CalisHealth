package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Khoảng giá trị [minValue, maxValue) của 1 tiêu chí -> điểm và level của riêng bài đó. */
@Entity
@Table(name = "level_rule_bands")
@Getter
@Setter
@NoArgsConstructor
public class LevelRuleBand {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "criterion_id", nullable = false)
    private LevelRuleCriterion criterion;

    /** null = không chặn dưới; tính cả biên. */
    @Column(name = "min_value", precision = 12, scale = 3)
    private BigDecimal minValue;

    /** null = không chặn trên; không tính biên. */
    @Column(name = "max_value", precision = 12, scale = 3)
    private BigDecimal maxValue;

    @Column(nullable = false, precision = 8, scale = 3)
    private BigDecimal score;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fitness_level_id")
    private FitnessLevel fitnessLevel;

    @Column(name = "band_label", length = 100)
    private String bandLabel;

    /** JSON điều kiện theo câu trả lời khác (cùng cú pháp conditional_rules); null = luôn áp dụng. */
    @Column(name = "applies_when", columnDefinition = "json")
    private String appliesWhen;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
