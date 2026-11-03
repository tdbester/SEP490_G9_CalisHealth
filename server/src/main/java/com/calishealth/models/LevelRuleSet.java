package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Bộ luật phân loại level cho 1 survey_code; version bất biến sau khi ACTIVE như surveys. */
@Entity
@Table(name = "level_rule_sets")
@Getter
@Setter
@NoArgsConstructor
public class LevelRuleSet {
    public enum Status { DRAFT, ACTIVE, ARCHIVED }

    /** WEIGHTED_AVERAGE: trung bình có trọng số. MINIMUM: điểm của tiêu chí yếu nhất. */
    public enum ScoringMethod { WEIGHTED_AVERAGE, MINIMUM }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rule_set_code", nullable = false, length = 64)
    private String ruleSetCode;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "survey_code", nullable = false, length = 64)
    private String surveyCode;

    @Column(nullable = false)
    private int version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_method", nullable = false, length = 32)
    private ScoringMethod scoringMethod = ScoringMethod.WEIGHTED_AVERAGE;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
