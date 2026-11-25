package com.calishealth.service;

import com.calishealth.dtos.FormRuleSuggestionDtos.SuggestedRule;
import com.calishealth.dtos.FormRuleSuggestionDtos.SuggestionResponse;
import com.calishealth.models.FormRule;
import com.calishealth.repository.FormRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Gợi ý ngưỡng chấm form cho member khi tạo bài tập custom.
 *
 * <p>Gợi ý được tính từ trung bình các ngưỡng đang dùng của các bài trong cùng
 * nhóm chuyển động (PUSH / PULL / LEGS / CORE) và cùng loại bài (REPS / HOLD).
 */
@Service
@RequiredArgsConstructor
public class FormRuleSuggestionService {

    private final FormRuleRepository formRules;

    /**
     * Gợi ý ngưỡng cho một nhóm chuyển động và loại bài.
     *
     * @param movementGroup nhóm chuyển động: PUSH | PULL | LEGS | CORE
     * @param category loại bài: REPS | HOLD (null = không lọc theo loại)
     */
    @Transactional(readOnly = true)
    public SuggestionResponse suggest(String movementGroup, String category) {
        String group = movementGroup == null ? "" : movementGroup.trim().toUpperCase(Locale.ROOT);
        String measure = category == null ? null : category.trim().toUpperCase(Locale.ROOT);
        List<FormRule> rules = formRules.findByMovementGroup(group, measure);

        // Gom theo khớp để tính trung bình từng thuộc tính.
        Map<String, List<FormRule>> byJoint = new LinkedHashMap<>();
        for (FormRule rule : rules) {
            if (rule.getJoint() == null) continue;
            byJoint.computeIfAbsent(rule.getJoint().trim().toUpperCase(Locale.ROOT), key -> new ArrayList<>())
                    .add(rule);
        }

        List<SuggestedRule> suggestions = new ArrayList<>();
        for (Map.Entry<String, List<FormRule>> entry : byJoint.entrySet()) {
            List<FormRule> group2 = entry.getValue();
            suggestions.add(new SuggestedRule(
                    entry.getKey(),
                    average(group2, FormRule::getAngleThreshold),
                    average(group2, FormRule::getRomDepth),
                    average(group2, FormRule::getMinAngle),
                    average(group2, FormRule::getMaxAngle),
                    average(group2, FormRule::getWeight),
                    average(group2, FormRule::getTolerance),
                    group2.size()));
        }
        suggestions.sort((left, right) -> Integer.compare(right.similarCount(), left.similarCount()));

        return new SuggestionResponse(group, measure, suggestions, rules.size());
    }

    private BigDecimal average(List<FormRule> rules, java.util.function.Function<FormRule, BigDecimal> getter) {
        BigDecimal sum = BigDecimal.ZERO;
        int count = 0;
        for (FormRule rule : rules) {
            BigDecimal value = getter.apply(rule);
            if (value == null) continue;
            sum = sum.add(value);
            count += 1;
        }
        if (count == 0) return null;
        return sum.divide(BigDecimal.valueOf(count), 3, RoundingMode.HALF_UP);
    }
}
