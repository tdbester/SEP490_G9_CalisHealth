package com.calishealth.service.survey.level;

import com.calishealth.dtos.SurveyDtos.Recommendation;
import com.calishealth.models.LevelRuleBand;
import com.calishealth.models.LevelRuleCriterion;
import com.calishealth.models.LevelRuleOutcome;
import com.calishealth.models.LevelRuleSet;
import com.calishealth.repository.LevelRuleCriterionRepository;
import com.calishealth.repository.LevelRuleOutcomeRepository;
import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.condition.Condition;
import com.calishealth.service.survey.condition.ConditionParser;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Band;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Criterion;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.LevelRef;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Outcome;
import com.calishealth.service.survey.questiontype.NumberQuestionType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Đọc 1 bộ luật phân loại level từ DB (3 query) thành LevelRuleSetDefinition và kiểm tra nó
 * với survey mà bộ luật chấm. Lỗi được gom vào problems; caller quyết định log / dùng level dự phòng.
 */
@Component
@RequiredArgsConstructor
public class LevelRuleSetLoader {
    private final LevelRuleCriterionRepository criteria;
    private final LevelRuleOutcomeRepository outcomes;

    public LevelRuleSetDefinition load(LevelRuleSet ruleSet, SurveyDefinition survey, List<String> problems) {
        Map<Long, List<Band>> bandsByCriterion = new HashMap<>();
        for (LevelRuleBand band : criteria.findBandsByRuleSetId(ruleSet.getId())) {
            bandsByCriterion.computeIfAbsent(band.getCriterion().getId(), k -> new ArrayList<>())
                    .add(toBand(band, problems));
        }

        List<Criterion> criterionDefinitions = criteria.findByRuleSetIdOrderBySortOrderAsc(ruleSet.getId()).stream()
                .map(c -> new Criterion(c.getCriterionCode(), c.getLabel(), c.getQuestionCode(), c.getWeight(),
                        c.isRequired(), bandsByCriterion.getOrDefault(c.getId(), List.of())))
                .toList();

        List<Outcome> outcomeDefinitions = outcomes.findByRuleSetId(ruleSet.getId()).stream()
                .map(o -> toOutcome(o, problems))
                .toList();

        LevelRuleSetDefinition definition = new LevelRuleSetDefinition(ruleSet.getId(), ruleSet.getRuleSetCode(),
                ruleSet.getName(), ruleSet.getVersion(), ruleSet.getScoringMethod(), criterionDefinitions,
                outcomeDefinitions);
        problems.addAll(validate(definition, survey));
        return definition;
    }

    /** Kiểm tra bộ luật với survey mà nó chấm; rỗng = hợp lệ. */
    static List<String> validate(LevelRuleSetDefinition rules, SurveyDefinition survey) {
        List<String> problems = new ArrayList<>();
        Map<String, QuestionDefinition> questions = survey.allQuestions()
                .filter(StepQuestion::active)
                .map(StepQuestion::question)
                .collect(Collectors.toMap(QuestionDefinition::code, q -> q, (a, b) -> a, LinkedHashMap::new));

        if (rules.criteria().isEmpty()) {
            problems.add("Rule set has no criteria");
        }
        for (Criterion criterion : rules.criteria()) {
            String where = "Criterion " + criterion.code();
            QuestionDefinition question = questions.get(criterion.questionCode());
            if (question == null) {
                problems.add(where + " uses question " + criterion.questionCode()
                        + " which is not an active question of survey " + survey.code() + " v" + survey.version());
            } else if (!NumberQuestionType.TYPE.equals(question.type())) {
                problems.add(where + " uses question " + criterion.questionCode() + " of type " + question.type()
                        + "; only " + NumberQuestionType.TYPE + " questions can be scored");
            }
            if (criterion.weight() == null || criterion.weight().signum() <= 0) {
                problems.add(where + " must have a positive weight");
            }
            if (criterion.bands().isEmpty()) {
                problems.add(where + " has no bands");
            }
            for (Band band : criterion.bands()) {
                if (band.min() != null && band.max() != null && band.min().compareTo(band.max()) >= 0) {
                    problems.add(where + " has a band whose min_value is not below max_value");
                }
                if (band.appliesWhen() != null) {
                    for (String referenced : band.appliesWhen().referencedQuestions()) {
                        if (!questions.containsKey(referenced)) {
                            problems.add(where + " band condition references unknown question " + referenced);
                        }
                    }
                }
            }
        }

        if (rules.outcomes().isEmpty()) {
            problems.add("Rule set has no outcomes");
        }
        BigDecimal previous = null;
        for (Outcome outcome : rules.outcomes()) {
            // rank tăng thì min_score phải tăng, nếu không "Level n of m" sẽ ngược với điểm
            if (previous != null && outcome.minScore().compareTo(previous) <= 0) {
                problems.add("Outcome " + outcome.level().name() + " (rank " + outcome.rank()
                        + ") must have a higher min_score than the outcome ranked below it");
            }
            previous = outcome.minScore();
        }
        return problems;
    }

    private static Band toBand(LevelRuleBand band, List<String> problems) {
        String where = "Band " + band.getId() + " of criterion " + band.getCriterion().getCriterionCode();
        JsonNode conditionJson = null;
        Condition condition = null;
        try {
            conditionJson = SurveyJson.parse(band.getAppliesWhen());
            condition = ConditionParser.parse(conditionJson);
        } catch (IllegalArgumentException exception) {
            problems.add(where + " applies_when: " + exception.getMessage());
        }
        LevelRef level = band.getFitnessLevel() == null ? null
                : new LevelRef(band.getFitnessLevel().getId(), band.getFitnessLevel().getName());
        return new Band(band.getMinValue(), band.getMaxValue(), band.getScore(), level, band.getBandLabel(),
                conditionJson, condition);
    }

    private static Outcome toOutcome(LevelRuleOutcome outcome, List<String> problems) {
        JsonNode recommendation = null;
        try {
            recommendation = SurveyJson.parse(outcome.getRecommendation());
            // đọc thử để báo lỗi cấu trúc ngay khi load, không đợi tới lúc dựng kế hoạch
            SurveyJson.read(outcome.getRecommendation(), Recommendation.class);
        } catch (IllegalArgumentException exception) {
            problems.add("Outcome " + outcome.getFitnessLevel().getName() + " recommendation: " + exception.getMessage());
            recommendation = null;
        }
        return new Outcome(new LevelRef(outcome.getFitnessLevel().getId(), outcome.getFitnessLevel().getName()),
                outcome.getMinScore(), outcome.getSortOrder(), outcome.getSummary(), recommendation);
    }
}
