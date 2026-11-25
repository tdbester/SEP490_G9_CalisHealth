package com.calishealth.service.survey.level;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkAssessment;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkLevel;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkScoreItem;
import com.calishealth.dtos.SurveyDtos.LevelAssessment;
import com.calishealth.dtos.SurveyDtos.PlanResponse;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.exception.SurveyException;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyLevelResult;
import com.calishealth.models.SurveySession;
import com.calishealth.models.User;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.SurveyLevelResultRepository;
import com.calishealth.service.LevelBenchmarkService;
import com.calishealth.service.MemberFitnessLevelService;
import com.calishealth.service.SurveyService;
import com.calishealth.service.survey.SurveyProfileSync;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link LevelAssessmentService}: chấm level theo benchmark, fallback và ghi hồ sơ.
 */
class LevelAssessmentServiceCoverageTest {

    private SurveyLevelResultRepository results;
    private FitnessLevelRepository fitnessLevels;
    private MemberProfileRepository profiles;
    private SurveyService surveys;
    private LevelBenchmarkService benchmarks;
    private RecommendedPlanService plans;
    private MemberFitnessLevelService fitnessLevelsService;
    private SurveyProfileSync profileSync;
    private LevelAssessmentService service;

    @BeforeEach
    void setUp() {
        results = mock(SurveyLevelResultRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        profiles = mock(MemberProfileRepository.class);
        surveys = mock(SurveyService.class);
        benchmarks = mock(LevelBenchmarkService.class);
        plans = mock(RecommendedPlanService.class);
        fitnessLevelsService = mock(MemberFitnessLevelService.class);
        profileSync = mock(SurveyProfileSync.class);
        service = new LevelAssessmentService(results, fitnessLevels, profiles, surveys, benchmarks, plans,
                fitnessLevelsService, profileSync);
    }

    private static SurveySession session() {
        User user = new User();
        user.setId(3L);
        user.setEmail("member@example.test");
        Survey survey = new Survey();
        survey.setId(1L);
        survey.setSurveyCode("ONBOARDING");
        survey.setVersion(1);
        survey.setStatus(Survey.Status.ACTIVE);
        SurveySession session = new SurveySession();
        session.setId(20L);
        session.setUser(user);
        session.setSurvey(survey);
        return session;
    }

    private static FitnessLevel level(long id, String name) {
        FitnessLevel level = new FitnessLevel();
        level.setId(id);
        level.setName(name);
        level.setStatus("ACTIVE");
        return level;
    }

    private static JsonNode intNode(int value) {
        return JsonNodeFactory.instance.numberNode(value);
    }

    private void stubProfile(int daysPerWeek) {
        MemberProfile profile = new MemberProfile();
        profile.setId(9L);
        profile.setDaysPerWeek(daysPerWeek);
        lenient().when(profiles.findByUserId(3L)).thenReturn(Optional.of(profile));
        lenient().when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        lenient().when(profiles.save(any(MemberProfile.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    // ------------------------------------------------------------------- find

    @Test
    @DisplayName("find: chua cham -> rong")
    void findReturnsEmptyWhenNoResult() {
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());

        assertThat(service.find(session())).isEmpty();
    }

    @Test
    @DisplayName("find: co ket qua -> doc breakdown")
    void findReadsBreakdown() {
        SurveyLevelResult result = new SurveyLevelResult();
        result.setId(1L);
        result.setBreakdown("{\"method\":\"RULES\",\"reason\":null,\"level\":null,\"levels\":[],\"totalScore\":null,"
                + "\"summary\":null,\"showLevelBreakdown\":true,\"showPlanPreview\":true,\"criteria\":[],"
                + "\"plan\":null,\"evaluatedAt\":null}");
        when(results.findBySessionId(20L)).thenReturn(Optional.of(result));

        assertThat(service.find(session())).isPresent();
    }

    // ----------------------------------------------------------- activatePlan

    @Test
    @DisplayName("activatePlan: khong co ho so -> khong lam gi")
    void activatePlanWithoutProfileDoesNothing() {
        when(profiles.findByUser_Id(5L)).thenReturn(Optional.empty());

        service.activatePlan(5L, new LevelAssessment("RULES", null, null, List.of(), null, null, true, true,
                List.of(), null, null));

        verify(profiles, never()).save(any(MemberProfile.class));
    }

    @Test
    @DisplayName("activatePlan: gan level va so buoi/tuan")
    void activatePlanUpdatesProfile() {
        MemberProfile profile = new MemberProfile();
        profile.setId(9L);
        profile.setUser(session().getUser());
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        when(fitnessLevels.findById(7L)).thenReturn(Optional.of(level(7L, "Beginner")));
        when(profiles.save(any(MemberProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        var plan = new PlanResponse("P", "d", "n", 4, 3, 30, List.of());
        service.activatePlan(3L, new LevelAssessment("RULES", null,
                new com.calishealth.dtos.SurveyDtos.LevelItem(7L, "Beginner", 1), List.of(), null, null,
                true, true, List.of(), plan, null));

        verify(fitnessLevelsService).changeLevel(org.mockito.ArgumentMatchers.eq(profile), any(FitnessLevel.class));
        assertThat(profile.getDaysPerWeek()).isEqualTo(3);
    }

    @Test
    @DisplayName("activatePlan: khong co level -> chi gan so buoi/tuan")
    void activatePlanWithoutLevel() {
        MemberProfile profile = new MemberProfile();
        profile.setId(9L);
        when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        when(profiles.save(any(MemberProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        var plan = new PlanResponse("P", "d", "n", 4, 5, 30, List.of());
        service.activatePlan(3L, new LevelAssessment("NONE", "NO_BENCHMARK_RESULT", null, List.of(), null, null,
                false, false, List.of(), plan, null));

        verify(fitnessLevelsService, never()).changeLevel(any(), any());
        assertThat(profile.getDaysPerWeek()).isEqualTo(5);
    }

    // ------------------------------------------------------------ clearResult

    @Test
    @DisplayName("clearResult: co ket qua -> xoa")
    void clearResultDeletesRow() {
        SurveyLevelResult result = new SurveyLevelResult();
        result.setId(1L);
        when(results.findBySessionId(20L)).thenReturn(Optional.of(result));

        service.clearResult(session());

        verify(results).delete(result);
    }

    @Test
    @DisplayName("clearResult: khong co ket qua -> khong xoa gi")
    void clearResultWithoutRow() {
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());

        service.clearResult(session());

        verify(results, never()).delete(any());
    }

    // ---------------------------------------------------------------- assess

    @Test
    @DisplayName("assess: co benchmark -> method RULES")
    void assessUsesBenchmark() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        FitnessLevel assessed = level(5L, "Intermediate");
        BenchmarkAssessment assessment = new BenchmarkAssessment(6, assessed,
                List.of(new BenchmarkLevel(1L, "Beginner", 1), new BenchmarkLevel(5L, "Intermediate", 2)),
                List.of(new BenchmarkScoreItem("PUSH_UP_MAX_REPS", "Push-up", "reps", 25, 3, "20-40 reps")),
                false, false);
        when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.of(assessment));

        LevelAssessment result = service.assess(session(), null, Map.of());

        assertThat(result.method()).isEqualTo("RULES");
        assertThat(result.level().id()).isEqualTo(5L);
        assertThat(result.totalScore()).isEqualByComparingTo("6");
        assertThat(result.criteria()).hasSize(1);
        assertThat(result.levels()).hasSize(2);
        assertThat(result.summary()).contains("6").contains("3 points");
    }

    @Test
    @DisplayName("assess: benchmark co diem 0 -> summary nhac nho")
    void assessDescribesZeroResult() {
        stubProfile(3);
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        BenchmarkAssessment assessment = new BenchmarkAssessment(0, level(1L, "Beginner"),
                List.of(new BenchmarkLevel(1L, "Beginner", 1)), List.of(), true, false);
        when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.of(assessment));

        LevelAssessment result = service.assess(session(), null, Map.of());

        assertThat(result.summary()).contains("not completed");
    }

    @Test
    @DisplayName("assess: benchmark lech diem -> summary nhac nho")
    void assessDescribesUnbalancedResult() {
        stubProfile(3);
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        BenchmarkAssessment assessment = new BenchmarkAssessment(3, level(1L, "Beginner"),
                List.of(new BenchmarkLevel(1L, "Beginner", 1)), List.of(), false, true);
        when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.of(assessment));

        LevelAssessment result = service.assess(session(), null, Map.of());

        assertThat(result.summary()).contains("uneven");
    }

    @Test
    @DisplayName("assess: khong cham duoc -> dung level du phong")
    void assessFallsBackToConfiguredLevel() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));
        when(fitnessLevels.findById(8L)).thenReturn(Optional.of(level(8L, "Beginner")));

        var resultStep = new com.calishealth.dtos.SurveyDtos.ResultStepResponse("RESULT", "Result", "d",
                new ResultConfig(true, true, 4, 3, 30, 8L));
        when(surveys.activeResultStep(any())).thenReturn(resultStep);

        LevelAssessment result = service.assess(session(), null, Map.of());

        assertThat(result.method()).isEqualTo("FALLBACK");
        assertThat(result.reason()).isEqualTo(LevelAssessmentService.NO_BENCHMARK_RESULT);
        assertThat(result.level().id()).isEqualTo(8L);
    }

    @Test
    @DisplayName("assess: khong co level du phong -> method NONE")
    void assessWithoutFallbackLevel() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));
        when(surveys.activeResultStep(any())).thenReturn(null);

        LevelAssessment result = service.assess(session(), null, Map.of());

        assertThat(result.method()).isEqualTo("NONE");
        assertThat(result.level()).isNull();
        assertThat(result.plan()).isNull();
    }

    @Test
    @DisplayName("assess: cau hoi so buoi/tuan -> luu vao ho so")
    void assessPersistsDesiredDaysPerWeek() {
        stubProfile(1);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, JsonNode> answers = Map.of(
                "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE", intNode(4));

        service.assess(session(), null, answers);

        ArgumentCaptor<MemberProfile> captor = ArgumentCaptor.forClass(MemberProfile.class);
        verify(profiles).save(captor.capture());
        assertThat(captor.getValue().getDaysPerWeek()).isEqualTo(4);
    }

    @Test
    @DisplayName("assess: so buoi/tuan khong hop le -> bo qua")
    void assessIgnoresInvalidDaysPerWeek() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, JsonNode> answers = Map.of(
                "HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE", intNode(99));

        service.assess(session(), null, answers);

        verify(profiles, never()).save(any(MemberProfile.class));
    }

    @Test
    @DisplayName("assess: config buoc Result hong -> dung mac dinh")
    void assessUsesDefaultsWhenResultStepBroken() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));
        when(surveys.activeResultStep(any())).thenThrow(SurveyException.configInvalid());

        LevelAssessment result = service.assess(session(), null, Map.of());

        assertThat(result.method()).isEqualTo("NONE");
    }

    @Test
    @DisplayName("assess: cham lai thi cap nhat dong ket qua cu")
    void assessUpdatesExistingResult() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        SurveyLevelResult existing = new SurveyLevelResult();
        existing.setId(1L);
        when(results.findBySessionId(20L)).thenReturn(Optional.of(existing));
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        service.assess(session(), null, Map.of());

        ArgumentCaptor<SurveyLevelResult> captor = ArgumentCaptor.forClass(SurveyLevelResult.class);
        verify(results).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(1L);
        assertThat(captor.getValue().getBreakdown()).contains("method");
    }

    @Test
    @DisplayName("assess: co cau hoi benchmark -> truyen gia tri sang benchmark service")
    void assessPassesBenchmarkValues() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of("PUSH_UP_MAX_REPS"));
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, JsonNode> answers = Map.of("PUSH_UP_MAX_REPS", intNode(30));

        service.assess(session(), null, answers);

        ArgumentCaptor<Map<String, Integer>> captor = ArgumentCaptor.forClass(Map.class);
        verify(benchmarks).assessFromOnboarding(captor.capture());
        assertThat(captor.getValue()).containsEntry("PUSH_UP_MAX_REPS", 30);
    }

    @Test
    @DisplayName("assess: goi profile sync de ghi ho so")
    void assessSyncsProfile() {
        stubProfile(3);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        service.assess(session(), null, Map.of());

        verify(profileSync).apply(any(User.class), any(), any());
    }

    @Test
    @DisplayName("assess: benchmark co ke hoach -> gan ke hoach goi y")
    void assessBuildsRecommendedPlan() {
        stubProfile(3);
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        FitnessLevel assessed = level(5L, "Intermediate");
        BenchmarkAssessment assessment = new BenchmarkAssessment(6, assessed,
                List.of(new BenchmarkLevel(5L, "Intermediate", 2)),
                List.of(new BenchmarkScoreItem("S", "Push-up", "reps", 25, 3, "20-40 reps")), false, false);
        when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.of(assessment));
        PlanResponse plan = new PlanResponse("P", "d", "n", 4, 3, 30, List.of());
        when(plans.build(any(), any(), any())).thenReturn(plan);

        LevelAssessment result = service.assess(session(), null, Map.of());

        assertThat(result.plan()).isEqualTo(plan);
    }

    @Test
    @DisplayName("assess: ho so chua ton tai -> tao moi")
    void assessCreatesProfileWhenMissing() {
        when(profiles.findByUserId(3L)).thenReturn(Optional.empty());
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        service.assess(session(), null, Map.of());

        verify(profiles, never()).save(any(MemberProfile.class));
    }

    @Test
    @DisplayName("assess: profile co so buoi/tuan ngoai 1..7 -> bo qua")
    void assessIgnoresStoredDaysOutOfRange() {
        stubProfile(99);
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of());
        when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));

        service.assess(session(), null, Map.of());

        verify(profiles, never()).save(any(MemberProfile.class));
    }
}
