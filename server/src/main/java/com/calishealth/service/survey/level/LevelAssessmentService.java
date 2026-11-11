package com.calishealth.service.survey.level;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkAssessment;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkLevel;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkScoreItem;
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
import com.calishealth.service.LevelBenchmarkService;
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
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
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
    private final LevelBenchmarkService benchmarks;
    private final RecommendedPlanService plans;
    private final com.calishealth.service.MemberFitnessLevelService fitnessLevelsService;

    /** Câu hỏi "bạn muốn tập mấy buổi/tuần" -> member_profiles.days_per_week. */
    private static final String DAYS_PER_WEEK_QUESTION = "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE";
    private static final String CURRENT_DAYS_PER_WEEK_QUESTION = "TRAINING_DAYS_PER_WEEK";

    /** Kết quả đã chấm của phiên, nếu có. */
    public Optional<LevelAssessment> find(SurveySession session) {
        return results.findBySessionId(session.getId())
                .map(result -> SurveyJson.read(result.getBreakdown(), LevelAssessment.class));
    }

    /**
     * "Start my training plan": ghi level và số buổi/tuần của kế hoạch vào hồ sơ member.
     * Level đã được lưu lúc chấm; hành động này xác nhận kế hoạch được bắt đầu nên nhịp tập cũng được cập nhật.
     */
    @Transactional
    public void activatePlan(Long userId, LevelAssessment assessment) {
        MemberProfile profile = profiles.findByUser_Id(userId).orElse(null);
        if (profile == null) {
            return;
        }
        if (assessment.level() != null && assessment.level().id() != null) {
            fitnessLevels.findById(assessment.level().id())
                    .ifPresent(level -> fitnessLevelsService.changeLevel(profile, level));
        }
        if (assessment.plan() != null && assessment.plan().sessionsPerWeek() > 0) {
            profile.setDaysPerWeek(assessment.plan().sessionsPerWeek());
        }
        profiles.save(profile);
    }

    /** Xoá kết quả chấm của phiên (member mở lại level test để sửa). */
    @Transactional
    public void clearResult(SurveySession session) {
        results.findBySessionId(session.getId()).ifPresent(results::delete);
    }

    public LevelAssessment assess(SurveySession session, SurveyDefinition survey, Map<String, JsonNode> answers) {
        ResultConfig config = resultConfig(session);
        Integer daysPerWeek = persistAndReadDaysPerWeek(session, answers);
        Optional<LevelRuleSet> ruleSet = ruleSets.findBySurveyCodeAndStatus(survey.code(), LevelRuleSet.Status.ACTIVE);
        LevelRuleSetDefinition rules = ruleSet.map(set -> validRules(set, survey)).orElse(null);
        Evaluation evaluation = rules == null ? null : LevelRuleEvaluator.evaluate(rules, answers);

        // Bộ luật riêng của survey (level_rule_sets) là nguồn chính; khi survey chưa cấu hình bộ luật
        // thì chấm theo bảng Level Criteria (Exercise point rules) của benchmark.
        Optional<BenchmarkAssessment> benchmark = evaluation == null || evaluation.outcome() == null
                ? benchmarks.assessFromOnboarding(benchmarkValues(answers))
                : Optional.empty();

        SurveyLevelResult.Method method;
        String reason = null;
        FitnessLevel level;
        LevelItem levelItem;
        List<LevelItem> ladder;
        BigDecimal totalScore = null;
        String summary = null;
        List<CriterionResultItem> criteria = List.of();
        PlanResponse plan = null;

        if (evaluation != null && evaluation.outcome() != null) {
            method = SurveyLevelResult.Method.RULES;
            level = fitnessLevels.getReferenceById(evaluation.outcome().level().id());
            Long levelId = level.getId();
            Optional<Outcome> outcome = rules.outcomeOf(levelId);
            levelItem = new LevelItem(levelId, outcome.map(o -> o.level().name()).orElseGet(level::getName),
                    outcome.map(Outcome::rank).orElse(null));
            ladder = rules.outcomes().stream()
                    .map(o -> new LevelItem(o.level().id(), o.level().name(), o.rank()))
                    .toList();
            totalScore = evaluation.totalScore();
            summary = outcome.map(Outcome::summary).orElse(null);
            criteria = criteriaItems(evaluation, survey);
            plan = outcome.map(o -> plan(o, config, daysPerWeek)).orElse(null);
        } else if (benchmark.isPresent()) {
            method = SurveyLevelResult.Method.RULES;
            BenchmarkAssessment assessed = benchmark.get();
            level = assessed.level();
            levelItem = new LevelItem(level.getId(), level.getName(), null);
            ladder = assessed.ladder().stream()
                    .map(item -> new LevelItem(item.id(), item.name(), item.rank()))
                    .toList();
            levelItem = new LevelItem(level.getId(), level.getName(),
                    ladder.stream().filter(item -> item.id().equals(level.getId()))
                            .map(LevelItem::rank).findFirst().orElse(null));
            totalScore = BigDecimal.valueOf(assessed.totalScore());
            criteria = benchmarkCriteria(assessed);
            summary = benchmarkSummary(assessed);
            plan = plans.build(level, daysPerWeek, config);
        } else {
            reason = ruleSet.isEmpty() ? NO_RULE_SET : rules == null ? RULES_INVALID : evaluation.failureReason();
            level = config.fallbackFitnessLevelId() == null ? null
                    : fitnessLevels.findById(config.fallbackFitnessLevelId()).orElse(null);
            method = level == null ? SurveyLevelResult.Method.NONE : SurveyLevelResult.Method.FALLBACK;
            levelItem = level == null ? null : new LevelItem(level.getId(), level.getName(), null);
            ladder = List.of();
            plan = level == null ? null : plans.build(level, daysPerWeek, config);
        }

        LocalDateTime now = LocalDateTime.now();
        LevelAssessment assessment = new LevelAssessment(method.name(), reason, levelItem, ladder,
                totalScore, summary,
                config.showLevelBreakdown(), config.showPlanPreview(),
                criteria, plan, now);

        // 1 phiên - 1 kết quả: chấm lại (sửa level test) thì cập nhật dòng cũ thay vì thêm dòng mới.
        SurveyLevelResult result = results.findBySessionId(session.getId()).orElseGet(SurveyLevelResult::new);
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

    /** Câu trả lời level test theo slot của benchmark (mã câu hỏi -> số rep / giây). */
    private Map<String, Integer> benchmarkValues(Map<String, JsonNode> answers) {
        Map<String, Integer> values = new HashMap<>();
        if (answers == null) {
            return values;
        }
        for (String slot : benchmarks.benchmarkSlots()) {
            JsonNode node = answers.get(slot);
            if (node != null && node.canConvertToInt()) {
                values.put(slot, node.intValue());
            }
        }
        return values;
    }

    /** Điểm từng bài của level test, hiển thị ở màn "Result and recommended plan". */
    private static List<CriterionResultItem> benchmarkCriteria(BenchmarkAssessment assessed) {
        List<CriterionResultItem> items = new ArrayList<>();
        for (BenchmarkScoreItem score : assessed.scores()) {
            items.add(new CriterionResultItem(
                    score.slot(),
                    score.exerciseName(),
                    score.slot(),
                    BigDecimal.valueOf(score.value()),
                    score.unit(),
                    BigDecimal.valueOf(score.points()),
                    BigDecimal.ONE,
                    null,
                    score.bandLabel(),
                    true));
        }
        return items;
    }

    private static String benchmarkSummary(BenchmarkAssessment assessed) {
        int max = assessed.scores().size() * 3;
        StringBuilder text = new StringBuilder();
        text.append("You scored ").append(assessed.totalScore()).append(" of ").append(max)
                .append(" points on the level test.");
        if (assessed.zeroResult()) {
            text.append(" One exercise was not completed, so you start at the lowest level.");
        } else if (assessed.unbalanced()) {
            text.append(" Your results were uneven, so we placed you one level lower.");
        }
        return text.toString();
    }

    /** Số buổi/tuần member muốn (ưu tiên câu "muốn tập mấy buổi", không có thì dùng câu "đang tập mấy buổi"). */
    private static Integer desiredDaysPerWeek(Map<String, JsonNode> answers) {
        if (answers == null) {
            return null;
        }
        for (String code : List.of(DAYS_PER_WEEK_QUESTION, CURRENT_DAYS_PER_WEEK_QUESTION)) {
            JsonNode node = answers.get(code);
            if (node != null && node.canConvertToInt()) {
                int days = node.intValue();
                if (days >= 1 && days <= 7) {
                    return days;
                }
            }
        }
        return null;
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
    static PlanResponse plan(Outcome outcome, ResultConfig config, Integer desiredDaysPerWeek) {
        if (outcome.recommendation() == null) {
            return null;
        }
        Recommendation recommendation = SurveyJson.read(SurveyJson.write(outcome.recommendation()), Recommendation.class);
        List<SessionTemplate> sessions = recommendation.sessions() == null ? List.of() : recommendation.sessions();
        int perWeek = desiredDaysPerWeek == null || desiredDaysPerWeek < 1 || desiredDaysPerWeek > 7
                ? config.sessionsPerWeek()
                : desiredDaysPerWeek;
        List<PlanDayItem> rhythm = new ArrayList<>();
        for (int i = 0; i < perWeek && !sessions.isEmpty(); i++) {
            SessionTemplate template = sessions.get(i % sessions.size());
            rhythm.add(new PlanDayItem(WEEK_DAYS[i * WEEK_DAYS.length / perWeek], template.name(),
                    template.exercises() == null ? List.of() : template.exercises()));
        }
        return new PlanResponse(recommendation.planName(), recommendation.description(), recommendation.note(),
                config.planDurationWeeks(), perWeek, config.minutesPerSession(), rhythm);
    }

    static PlanResponse plan(Outcome outcome, ResultConfig config) {
        return plan(outcome, config, null);
    }

    private Integer persistAndReadDaysPerWeek(SurveySession session, Map<String, JsonNode> answers) {
        MemberProfile profile = profiles.findByUserId(session.getUser().getId()).orElseGet(() -> {
            MemberProfile created = new MemberProfile();
            created.setUser(session.getUser());
            return created;
        });
        Integer selected = desiredDaysPerWeek(answers);
        if (selected != null) {
            profile.setDaysPerWeek(selected);
            profiles.save(profile);
        }
        int stored = profile.getDaysPerWeek();
        return stored >= 1 && stored <= 7 ? stored : null;
    }

    private void updateProfileFromSurvey(SurveySession session, FitnessLevel level, Map<String, JsonNode> answers) {
        MemberProfile profile = profiles.findByUserId(session.getUser().getId()).orElseGet(() -> {
            MemberProfile created = new MemberProfile();
            created.setUser(session.getUser());
            return created;
        });

        if (level != null) {
            fitnessLevelsService.changeLevel(profile, level);
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
                String gender = com.calishealth.service.ProfileService.normaliseGender(genderNode.asText());
                if (gender != null) {
                    profile.setGender(gender);
                    session.getUser().setGender(gender);
                }
            }

            JsonNode goalNode = answers.get("GOAL_TYPE");
            if (goalNode != null) {
                profile.setGoals(goalNode.isTextual() ? goalNode.asText() : goalNode.toString());
            }

            Integer daysPerWeek = desiredDaysPerWeek(answers);
            if (daysPerWeek != null) {
                profile.setDaysPerWeek(daysPerWeek);
            }
        }

        profiles.save(profile);
        if (weight != null && height != null && height.compareTo(java.math.BigDecimal.ZERO) > 0) {
            java.math.BigDecimal bmi = com.calishealth.service.MemberTrackingService.calculateBmi(weight, height);
            if (bmi != null) {
                trackingRepository.saveBodyMetric(
                        profile.getId(), weight, height, bmi,
                        "Initial measurement from onboarding survey");
            }
        }
    }

}
