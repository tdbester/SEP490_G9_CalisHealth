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
import com.calishealth.models.MemberProfile;
import com.calishealth.models.SurveyLevelResult;
import com.calishealth.models.SurveySession;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.SurveyLevelResultRepository;
import com.calishealth.service.LevelBenchmarkService;
import com.calishealth.service.SurveyService;
import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.SurveyDefinition;
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
    /** Không chấm được theo benchmark (thiếu câu trả lời level test) -> dùng level dự phòng. */
    public static final String NO_BENCHMARK_RESULT = "NO_BENCHMARK_RESULT";

    private static final String[] WEEK_DAYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"};

    private final SurveyLevelResultRepository results;
    private final FitnessLevelRepository fitnessLevels;
    private final MemberProfileRepository profiles;
    private final SurveyService surveys;
    private final LevelBenchmarkService benchmarks;
    private final RecommendedPlanService plans;
    private final com.calishealth.service.MemberFitnessLevelService fitnessLevelsService;
    private final com.calishealth.service.survey.SurveyProfileSync profileSync;

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

        // Cap do nghiem thu la `benchmark_criteria` (bang "Exercise point rules").
        // V83 da bo 4 bang `level_rule_*` (deu rong, khong bao gio chay) nen khong con
        // "bo luat" rieng cua survey - chi con 1 duong cham duy nhat.
        Optional<BenchmarkAssessment> benchmark = benchmarks.assessFromOnboarding(benchmarkValues(answers));

        SurveyLevelResult.Method method;
        String reason = null;
        FitnessLevel level;
        LevelItem levelItem;
        List<LevelItem> ladder;
        BigDecimal totalScore = null;
        String summary = null;
        List<CriterionResultItem> criteria = List.of();
        PlanResponse plan = null;

        if (benchmark.isPresent()) {
            method = SurveyLevelResult.Method.RULES;
            BenchmarkAssessment assessed = benchmark.get();
            level = assessed.level();
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
            reason = NO_BENCHMARK_RESULT;
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

    /** Cấu hình bước Result; cấu hình hỏng không được chặn member hoàn thành khảo sát -> dùng mặc định. */
    private ResultConfig resultConfig(SurveySession session) {
        try {
            ResultStepResponse step = surveys.activeResultStep(session.getSurvey());
            return step == null ? ResultConfig.defaults() : step.config();
        } catch (SurveyException exception) {
            return ResultConfig.defaults();
        }
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

    /**
     * Ghi câu trả lời khảo sát vào hồ sơ member.
     * <p>
     * Toàn bộ ánh xạ (cân nặng, chiều cao, giới tính, mục tiêu, số buổi/tuần) nằm trong
     * {@link SurveyProfileSync}, và đó cũng là nơi duy nhất ghi vào {@code member_body_metrics}
     * (bản ghi đo đầu tiên) để Health Tracking có dữ liệu ngay sau khi khảo sát.
     */
    private void updateProfileFromSurvey(SurveySession session, FitnessLevel level, Map<String, JsonNode> answers) {
        profileSync.apply(session.getUser(), answers, level);
    }

}
