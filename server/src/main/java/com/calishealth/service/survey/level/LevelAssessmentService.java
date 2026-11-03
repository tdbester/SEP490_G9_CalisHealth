package com.calishealth.service.survey.level;

import com.calishealth.dtos.SurveyDtos.CriterionResultItem;
import com.calishealth.dtos.SurveyDtos.LevelAssessment;
import com.calishealth.dtos.SurveyDtos.LevelItem;
import com.calishealth.dtos.SurveyDtos.PlanDayItem;
import com.calishealth.dtos.SurveyDtos.PlanResponse;
import com.calishealth.dtos.SurveyDtos.Recommendation;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.dtos.SurveyDtos.ResultStepResponse;
import com.calishealth.dtos.SurveyDtos.SessionTemplate;
import com.calishealth.exception.SurveyException;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.LevelRuleSet;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.SurveyLevelResult;
import com.calishealth.models.SurveySession;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.LevelRuleSetRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.SurveyLevelResultRepository;
import com.calishealth.service.SurveyService;
import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.SurveyDefinition;
import com.calishealth.service.survey.level.LevelRuleEvaluator.CriterionScore;
import com.calishealth.service.survey.level.LevelRuleEvaluator.Evaluation;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Outcome;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Chấm level cho 1 phiên khảo sát đã hoàn thành theo bộ luật ACTIVE của survey, lưu kết quả
 * (survey_level_results) và cập nhật level trong hồ sơ member. Không chấm được theo luật
 * (chưa có bộ luật, cấu hình lỗi, thiếu kết quả level test...) -> dùng level dự phòng của bước Result.
 * Được gọi trong transaction của SurveySessionService (phiên đã bị khóa dòng).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LevelAssessmentService {
    public static final String NO_RULE_SET = "NO_RULE_SET";
    public static final String RULES_INVALID = "RULES_INVALID";

    private static final String[] WEEK_DAYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"};

    private final LevelRuleSetRepository ruleSets;
    private final LevelRuleSetLoader loader;
    private final SurveyLevelResultRepository results;
    private final FitnessLevelRepository fitnessLevels;
    private final MemberProfileRepository profiles;
    private final SurveyService surveys;
    private final com.calishealth.repository.MemberTrackingRepository trackingRepository;

    /** Kết quả đã chấm của phiên, nếu có. */
    public Optional<LevelAssessment> find(SurveySession session) {
        return results.findBySessionId(session.getId())
                .map(result -> SurveyJson.read(result.getBreakdown(), LevelAssessment.class));
    }

    public LevelAssessment assess(SurveySession session, SurveyDefinition survey, Map<String, JsonNode> answers) {
        ResultConfig config = resultConfig(session);
        Optional<LevelRuleSet> ruleSet = ruleSets.findBySurveyCodeAndStatus(survey.code(), LevelRuleSet.Status.ACTIVE);
        LevelRuleSetDefinition rules = ruleSet.map(set -> validRules(set, survey)).orElse(null);
        Evaluation evaluation = rules == null ? null : LevelRuleEvaluator.evaluate(rules, answers);

        SurveyLevelResult.Method method;
        String reason = null;
        FitnessLevel level;
        if (evaluation != null && evaluation.outcome() != null) {
            method = SurveyLevelResult.Method.RULES;
            level = fitnessLevels.getReferenceById(evaluation.outcome().level().id());
        } else {
            reason = ruleSet.isEmpty() ? NO_RULE_SET : rules == null ? RULES_INVALID : evaluation.failureReason();
            level = config.fallbackFitnessLevelId() == null ? null
                    : fitnessLevels.findById(config.fallbackFitnessLevelId()).orElse(null);
            method = level == null ? SurveyLevelResult.Method.NONE : SurveyLevelResult.Method.FALLBACK;
        }

        Long levelId = level == null ? null : level.getId();
        Optional<Outcome> outcome = rules == null || levelId == null ? Optional.empty() : rules.outcomeOf(levelId);
        LevelItem levelItem = levelId == null ? null
                : new LevelItem(levelId, outcome.map(o -> o.level().name()).orElseGet(level::getName),
                        outcome.map(Outcome::rank).orElse(null));
        List<LevelItem> ladder = rules == null ? List.of() : rules.outcomes().stream()
                .map(o -> new LevelItem(o.level().id(), o.level().name(), o.rank()))
                .toList();

        LocalDateTime now = LocalDateTime.now();
        LevelAssessment assessment = new LevelAssessment(method.name(), reason, levelItem, ladder,
                evaluation == null ? null : evaluation.totalScore(),
                outcome.map(Outcome::summary).orElse(null),
                config.showLevelBreakdown(), config.showPlanPreview(),
                evaluation == null ? List.of() : criteriaItems(evaluation, survey),
                outcome.map(o -> plan(o, config)).orElse(null),
                now);

        SurveyLevelResult result = new SurveyLevelResult();
        result.setSession(session);
        result.setRuleSet(rules == null ? null : ruleSets.getReferenceById(rules.id()));
        result.setFitnessLevel(level);
        result.setTotalScore(assessment.totalScore());
        result.setMethod(method);
        result.setBreakdown(SurveyJson.writeValue(assessment));
        result.setEvaluatedAt(now);
        results.save(result);

        updateProfileFromSurvey(session, level, answers);
        return assessment;
    }

    /** Bộ luật đã kiểm tra với survey; null nếu cấu hình lỗi (đã log). */
    private LevelRuleSetDefinition validRules(LevelRuleSet ruleSet, SurveyDefinition survey) {
        List<String> problems = new ArrayList<>();
        LevelRuleSetDefinition rules = loader.load(ruleSet, survey, problems);
        if (!problems.isEmpty()) {
            log.error("Level rule set {} v{} is invalid for survey {} v{}, using the fallback level:\n - {}",
                    rules.code(), rules.version(), survey.code(), survey.version(), String.join("\n - ", problems));
            return null;
        }
        return rules;
    }

    /** Cấu hình bước Result; cấu hình hỏng không được chặn member hoàn thành khảo sát -> dùng mặc định. */
    private ResultConfig resultConfig(SurveySession session) {
        try {
            ResultStepResponse step = surveys.activeResultStep(session.getSurvey());
            return step == null ? ResultConfig.defaults() : step.config();
        } catch (SurveyException exception) {
            return ResultConfig.defaults();
        }
    }

    private static List<CriterionResultItem> criteriaItems(Evaluation evaluation, SurveyDefinition survey) {
        return evaluation.criteria().stream().map(score -> {
            String unit = survey.allQuestions()
                    .map(sq -> sq.question())
                    .filter(q -> q.code().equals(score.criterion().questionCode()))
                    .findFirst()
                    .map(QuestionDefinition::unit)
                    .orElse(null);
            return toItem(score, unit);
        }).toList();
    }

    private static CriterionResultItem toItem(CriterionScore score, String unit) {
        return new CriterionResultItem(score.criterion().code(), score.criterion().label(),
                score.criterion().questionCode(), score.value(), unit,
                score.scored() ? score.band().score() : null,
                score.criterion().weight(),
                score.scored() && score.band().level() != null ? score.band().level().name() : null,
                score.scored() ? score.band().displayLabel() : null,
                score.scored());
    }

    /**
     * Kế hoạch gợi ý: nội dung (tên, buổi tập, bài tập) theo level, nhịp độ (số tuần, buổi/tuần, phút/buổi)
     * theo cấu hình bước Result. Các buổi trải đều trong tuần, lặp vòng theo danh sách sessions.
     */
    static PlanResponse plan(Outcome outcome, ResultConfig config) {
        if (outcome.recommendation() == null) {
            return null;
        }
        Recommendation recommendation = SurveyJson.read(SurveyJson.write(outcome.recommendation()), Recommendation.class);
        List<SessionTemplate> sessions = recommendation.sessions() == null ? List.of() : recommendation.sessions();
        int perWeek = config.sessionsPerWeek();
        List<PlanDayItem> rhythm = new ArrayList<>();
        for (int i = 0; i < perWeek && !sessions.isEmpty(); i++) {
            SessionTemplate template = sessions.get(i % sessions.size());
            rhythm.add(new PlanDayItem(WEEK_DAYS[i * WEEK_DAYS.length / perWeek], template.name(),
                    template.exercises() == null ? List.of() : template.exercises()));
        }
        return new PlanResponse(recommendation.planName(), recommendation.description(), recommendation.note(),
                config.planDurationWeeks(), perWeek, config.minutesPerSession(), rhythm);
    }

    private void updateProfileFromSurvey(SurveySession session, FitnessLevel level, Map<String, JsonNode> answers) {
        MemberProfile profile = profiles.findByUserId(session.getUser().getId()).orElseGet(() -> {
            MemberProfile created = new MemberProfile();
            created.setUser(session.getUser());
            return created;
        });

        if (level != null) {
            profile.setFitnessLevel(level);
        }

        java.math.BigDecimal weight = null;
        java.math.BigDecimal height = null;

        if (answers != null) {
            JsonNode weightNode = answers.get("WEIGHT");
            if (weightNode != null && weightNode.isNumber()) {
                weight = weightNode.decimalValue();
                profile.setWeight(weight);
            }

            JsonNode heightNode = answers.get("HEIGHT");
            if (heightNode != null && heightNode.isNumber()) {
                height = heightNode.decimalValue();
                profile.setHeight(height);
            }

            JsonNode genderNode = answers.get("GENDER");
            if (genderNode != null && genderNode.isTextual()) {
                profile.setGender(genderNode.asText());
            }

            JsonNode goalNode = answers.get("GOAL_TYPE");
            if (goalNode != null) {
                profile.setGoals(goalNode.isTextual() ? goalNode.asText() : goalNode.toString());
            }
        }

        profiles.save(profile);

        // Tự động ghi bản ghi đo đầu tiên vào member_body_metrics
        if (weight != null && height != null && height.compareTo(java.math.BigDecimal.ZERO) > 0) {
            java.math.BigDecimal bmi = com.calishealth.service.MemberTrackingService.calculateBmi(weight, height);
            if (bmi != null) {
                trackingRepository.saveBodyMetric(
                        profile.getId(),
                        weight,
                        height,
                        bmi,
                        "Initial measurement from onboarding survey"
                );
            }
        }
    }
}
