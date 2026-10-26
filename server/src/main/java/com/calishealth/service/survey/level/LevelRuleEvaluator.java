package com.calishealth.service.survey.level;

import com.calishealth.service.survey.level.LevelRuleSetDefinition.Band;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Criterion;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Outcome;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Thuật toán chấm level chung cho mọi bộ luật. Không chứa ngưỡng của bài tập nào:
 * <ol>
 *   <li>Mỗi tiêu chí: lấy câu trả lời số của questionCode, chọn khoảng đầu tiên (theo thứ tự) có điều kiện
 *       thỏa và chứa giá trị -> điểm của tiêu chí.</li>
 *   <li>Điểm tổng: WEIGHTED_AVERAGE = Σ(trọng số × điểm) / Σ trọng số; MINIMUM = điểm thấp nhất.</li>
 *   <li>Level = mốc có minScore cao nhất mà điểm tổng đạt được.</li>
 * </ol>
 * Tiêu chí bắt buộc thiếu câu trả lời / không khớp khoảng nào -> không chấm (failureReason), để caller dùng
 * level dự phòng thay vì đoán.
 */
public final class LevelRuleEvaluator {
    public static final String MISSING_REQUIRED_ANSWER = "MISSING_REQUIRED_ANSWER";
    public static final String NO_MATCHING_BAND = "NO_MATCHING_BAND";
    public static final String NOTHING_SCORED = "NOTHING_SCORED";
    public static final String BELOW_LOWEST_OUTCOME = "BELOW_LOWEST_OUTCOME";

    private static final int SCORE_SCALE = 3;

    private LevelRuleEvaluator() {
    }

    /** Kết quả chấm 1 tiêu chí; value null = chưa trả lời, band null = không chấm được. */
    public record CriterionScore(Criterion criterion, BigDecimal value, Band band) {
        public boolean scored() {
            return band != null;
        }
    }

    /** outcome null = không xếp được level, khi đó failureReason cho biết lý do. */
    public record Evaluation(BigDecimal totalScore, Outcome outcome, List<CriterionScore> criteria, String failureReason) {
        public Evaluation {
            criteria = List.copyOf(criteria);
        }
    }

    public static Evaluation evaluate(LevelRuleSetDefinition rules, Map<String, JsonNode> answers) {
        List<CriterionScore> scores = new ArrayList<>();
        String failure = null;
        for (Criterion criterion : rules.criteria()) {
            BigDecimal value = numberOf(answers.get(criterion.questionCode()));
            Band band = value == null ? null : matchingBand(criterion, value, answers);
            scores.add(new CriterionScore(criterion, value, band));
            if (criterion.required() && failure == null) {
                if (value == null) {
                    failure = MISSING_REQUIRED_ANSWER;
                } else if (band == null) {
                    failure = NO_MATCHING_BAND;
                }
            }
        }
        if (failure != null) {
            return new Evaluation(null, null, scores, failure);
        }

        List<CriterionScore> scored = scores.stream().filter(CriterionScore::scored).toList();
        if (scored.isEmpty()) {
            return new Evaluation(null, null, scores, NOTHING_SCORED);
        }
        BigDecimal total = switch (rules.scoringMethod()) {
            case WEIGHTED_AVERAGE -> weightedAverage(scored);
            case MINIMUM -> scored.stream().map(s -> s.band().score()).min(BigDecimal::compareTo).orElseThrow();
        };
        total = total.setScale(SCORE_SCALE, RoundingMode.HALF_UP);

        Outcome reached = null;
        for (Outcome outcome : rules.outcomes()) {
            if (total.compareTo(outcome.minScore()) >= 0
                    && (reached == null || outcome.minScore().compareTo(reached.minScore()) > 0)) {
                reached = outcome;
            }
        }
        return new Evaluation(total, reached, scores, reached == null ? BELOW_LOWEST_OUTCOME : null);
    }

    private static Band matchingBand(Criterion criterion, BigDecimal value, Map<String, JsonNode> answers) {
        for (Band band : criterion.bands()) {
            if (band.appliesTo(answers) && band.contains(value)) {
                return band;
            }
        }
        return null;
    }

    private static BigDecimal weightedAverage(List<CriterionScore> scored) {
        BigDecimal weighted = BigDecimal.ZERO;
        BigDecimal weights = BigDecimal.ZERO;
        for (CriterionScore score : scored) {
            weighted = weighted.add(score.criterion().weight().multiply(score.band().score()));
            weights = weights.add(score.criterion().weight());
        }
        return weighted.divide(weights, SCORE_SCALE + 2, RoundingMode.HALF_UP);
    }

    /** Câu trả lời NUMBER đã được handler chuẩn hóa thành số JSON; kiểu khác coi như chưa trả lời. */
    private static BigDecimal numberOf(JsonNode node) {
        return node != null && node.isNumber() ? node.decimalValue() : null;
    }
}
