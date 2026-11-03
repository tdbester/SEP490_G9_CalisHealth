package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Kết quả chấm level của 1 phiên khảo sát đã hoàn thành (1 phiên - 1 kết quả). */
@Entity
@Table(name = "survey_level_results")
@Getter
@Setter
@NoArgsConstructor
public class SurveyLevelResult {
    /** RULES: chấm theo bộ luật. FALLBACK: dùng level dự phòng của bước Result. NONE: không gán level. */
    public enum Method { RULES, FALLBACK, NONE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    private SurveySession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_set_id")
    private LevelRuleSet ruleSet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fitness_level_id")
    private FitnessLevel fitnessLevel;

    @Column(name = "total_score", precision = 8, scale = 3)
    private BigDecimal totalScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Method method;

    /** JSON thô của SurveyDtos.LevelAssessment: ảnh chụp đầy đủ màn Result tại thời điểm chấm. */
    @Column(nullable = false, columnDefinition = "json")
    private String breakdown;

    @Column(name = "evaluated_at", nullable = false)
    private LocalDateTime evaluatedAt;
}
