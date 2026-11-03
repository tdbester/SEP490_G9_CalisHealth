package com.calishealth.service.survey.level;

import com.calishealth.models.LevelRuleSet.ScoringMethod;
import com.calishealth.service.survey.condition.Condition;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Ảnh chụp bất biến của 1 bộ luật phân loại level đã đọc từ DB. LevelRuleEvaluator chỉ làm việc
 * với các record này (không phụ thuộc JPA) nên dễ unit test.
 */
public record LevelRuleSetDefinition(
        Long id,
        String code,
        String name,
        int version,
        ScoringMethod scoringMethod,
        List<Criterion> criteria,
        List<Outcome> outcomes
) {
    public LevelRuleSetDefinition {
        criteria = List.copyOf(criteria);
        outcomes = outcomes.stream().sorted(Comparator.comparingInt(Outcome::rank)).toList();
    }

    public Optional<Outcome> outcomeOf(Long fitnessLevelId) {
        return outcomes.stream().filter(o -> o.level().id().equals(fitnessLevelId)).findFirst();
    }

    /** Level của bộ luật hoặc của 1 khoảng giá trị. */
    public record LevelRef(Long id, String name) {}

    public record Criterion(
            String code,
            String label,
            String questionCode,
            BigDecimal weight,
            boolean required,
            List<Band> bands
    ) {
        public Criterion {
            bands = List.copyOf(bands);
        }
    }

    /**
     * Khoảng [min, max) của 1 tiêu chí. min/max null = không chặn phía đó.
     * appliesWhen null = luôn áp dụng; có điều kiện thì chỉ xét khi câu trả lời khác thỏa (vd GENDER = FEMALE).
     */
    public record Band(
            BigDecimal min,
            BigDecimal max,
            BigDecimal score,
            LevelRef level,
            String label,
            JsonNode appliesWhenJson,
            Condition appliesWhen
    ) {
        public boolean contains(BigDecimal value) {
            return (min == null || value.compareTo(min) >= 0) && (max == null || value.compareTo(max) < 0);
        }

        public boolean appliesTo(Map<String, JsonNode> answers) {
            return appliesWhen == null || appliesWhen.test(answers);
        }

        /** Nhãn hiển thị: band_label nếu có, không thì tên level. */
        public String displayLabel() {
            return label != null ? label : level == null ? null : level.name();
        }
    }

    /** Điểm tổng >= minScore -> level; rank 1 = level thấp nhất. */
    public record Outcome(
            LevelRef level,
            BigDecimal minScore,
            int rank,
            String summary,
            JsonNode recommendation
    ) {}
}
