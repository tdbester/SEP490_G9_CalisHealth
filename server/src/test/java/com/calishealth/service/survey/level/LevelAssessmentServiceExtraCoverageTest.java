package com.calishealth.service.survey.level;

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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link LevelAssessmentService}: cac nhanh "answers rong/null" cua
 * {@code benchmarkValues} va {@code desiredDaysPerWeek}.
 */
class LevelAssessmentServiceExtraCoverageTest {

    private SurveyLevelResultRepository results;
    private FitnessLevelRepository fitnessLevels;
    private MemberProfileRepository profiles;
    private SurveyService surveys;
    private LevelBenchmarkService benchmarks;
    private SurveyProfileSync profileSync;
    private LevelAssessmentService service;

    @BeforeEach
    void setUp() {
        results = mock(SurveyLevelResultRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        profiles = mock(MemberProfileRepository.class);
        surveys = mock(SurveyService.class);
        benchmarks = mock(LevelBenchmarkService.class);
        profileSync = mock(SurveyProfileSync.class);
        service = new LevelAssessmentService(results, fitnessLevels, profiles, surveys, benchmarks,
                mock(RecommendedPlanService.class), mock(MemberFitnessLevelService.class), profileSync);

        MemberProfile profile = new MemberProfile();
        profile.setId(9L);
        profile.setDaysPerWeek(3);
        lenient().when(profiles.findByUserId(3L)).thenReturn(Optional.of(profile));
        lenient().when(profiles.findByUser_Id(3L)).thenReturn(Optional.of(profile));
        lenient().when(profiles.save(any(MemberProfile.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(benchmarks.benchmarkSlots()).thenReturn(List.of("PUSH_UP_MAX_REPS"));
        lenient().when(benchmarks.assessFromOnboarding(any())).thenReturn(Optional.empty());
        lenient().when(results.findBySessionId(20L)).thenReturn(Optional.empty());
        lenient().when(results.save(any(SurveyLevelResult.class))).thenAnswer(inv -> inv.getArgument(0));
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

    @Test
    @DisplayName("assess: answers null -> benchmark nhan ban rong")
    void nullAnswersProduceEmptyBenchmarkValues() {
        service.assess(session(), null, null);

        ArgumentCaptor<Map<String, Integer>> captor = ArgumentCaptor.forClass(Map.class);
        verify(benchmarks).assessFromOnboarding(captor.capture());
        assertThat(captor.getValue()).isEmpty();
    }

    @Test
    @DisplayName("assess: cau hoi benchmark khong phai so -> bo qua")
    void nonNumericBenchmarkAnswerIsIgnored() {
        Map<String, JsonNode> answers = Map.of("PUSH_UP_MAX_REPS",
                JsonNodeFactory.instance.textNode("30"));

        service.assess(session(), null, answers);

        ArgumentCaptor<Map<String, Integer>> captor = ArgumentCaptor.forClass(Map.class);
        verify(benchmarks).assessFromOnboarding(captor.capture());
        assertThat(captor.getValue()).isEmpty();
    }

    @Test
    @DisplayName("assess: answers null -> so buoi/tuan giu nguyen gia tri trong ho so")
    void nullAnswersKeepStoredDaysPerWeek() {
        service.assess(session(), null, null);

        verify(profiles, org.mockito.Mockito.never()).save(any(MemberProfile.class));
    }

    @Test
    @DisplayName("assess: cau hoi so buoi/tuan thu hai duoc dung khi cau hoi dau khong co")
    void fallbackDaysPerWeekQuestionIsUsed() {
        Map<String, JsonNode> answers = Map.of("TRAINING_DAYS_PER_WEEK",
                JsonNodeFactory.instance.numberNode(5));

        service.assess(session(), null, answers);

        ArgumentCaptor<MemberProfile> captor = ArgumentCaptor.forClass(MemberProfile.class);
        verify(profiles).save(captor.capture());
        assertThat(captor.getValue().getDaysPerWeek()).isEqualTo(5);
    }

    @Test
    @DisplayName("assess: so buoi/tuan tuong lai > 7 -> bo qua")
    void daysPerWeekAboveRangeIsIgnored() {
        Map<String, JsonNode> answers = Map.of("TRAINING_DAYS_PER_WEEK",
                JsonNodeFactory.instance.numberNode(9));

        service.assess(session(), null, answers);

        verify(profiles, org.mockito.Mockito.never()).save(any(MemberProfile.class));
    }

    @Test
    @DisplayName("assess: so buoi/tuan khong phai so -> bo qua")
    void nonNumericDaysPerWeekIsIgnored() {
        Map<String, JsonNode> answers = Map.of("TRAINING_DAYS_PER_WEEK",
                JsonNodeFactory.instance.textNode("five"));

        service.assess(session(), null, answers);

        verify(profiles, org.mockito.Mockito.never()).save(any(MemberProfile.class));
    }

    @Test
    @DisplayName("assess: fallback level -> gan level vao ho so qua profile sync")
    void fallbackLevelIsPassedToProfileSync() {
        FitnessLevel level = new FitnessLevel();
        level.setId(8L);
        level.setName("Beginner");
        when(fitnessLevels.findById(8L)).thenReturn(Optional.of(level));
        var resultStep = new com.calishealth.dtos.SurveyDtos.ResultStepResponse("RESULT", "Result", "d",
                new com.calishealth.dtos.SurveyDtos.ResultConfig(true, true, 4, 3, 30, 8L));
        when(surveys.activeResultStep(any())).thenReturn(resultStep);

        service.assess(session(), null, Map.of());

        ArgumentCaptor<FitnessLevel> captor = ArgumentCaptor.forClass(FitnessLevel.class);
        verify(profileSync).apply(any(User.class), any(), captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(8L);
    }
}
