package com.calishealth.service.survey;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkConfiguration;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExercise;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.models.SurveyStepQuestion;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.repository.SurveyStepQuestionRepository;
import com.calishealth.repository.SurveyStepRepository;
import com.calishealth.service.LevelBenchmarkService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho cac startup runner va nhanh "bo qua" cua {@link BenchmarkSurveySync}.
 */
class SurveyStartupAndSyncExtraCoverageTest {

    private SurveyRepository surveys;
    private SurveyStepRepository steps;
    private SurveyStepQuestionRepository stepQuestions;
    private AssessmentQuestionRepository questions;
    private AssessmentAnswerRepository answers;
    private BenchmarkSurveySync sync;

    @BeforeEach
    void setUp() {
        surveys = mock(SurveyRepository.class);
        steps = mock(SurveyStepRepository.class);
        stepQuestions = mock(SurveyStepQuestionRepository.class);
        questions = mock(AssessmentQuestionRepository.class);
        answers = mock(AssessmentAnswerRepository.class);
        sync = new BenchmarkSurveySync(surveys, steps, stepQuestions, questions, answers);
        when(surveys.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of());
        when(surveys.findByStatus(Survey.Status.DRAFT)).thenReturn(List.of());
    }

    private static Survey survey(long id, String code) {
        Survey survey = new Survey();
        survey.setId(id);
        survey.setSurveyCode(code);
        survey.setVersion(2);
        survey.setStatus(Survey.Status.ACTIVE);
        return survey;
    }

    private static SurveyStep step(long id, long surveyId, String stepCode) {
        SurveyStep step = new SurveyStep();
        step.setId(id);
        step.setStepCode(stepCode);
        step.setSurvey(survey(surveyId, "ONBOARDING"));
        step.setStepType(SurveyStep.Type.QUESTIONS);
        step.setStatus(SurveyStep.Status.ACTIVE);
        return step;
    }

    // ------------------------------------------------------- SurveyConfigStartupCheck

    @Test
    @DisplayName("startup check: cau hinh hong -> log loi, khong chan khoi dong")
    void startupCheckSwallowsBrokenConfiguration() {
        SurveyRepository surveyRepository = mock(SurveyRepository.class);
        SurveyDefinitionLoader loader = mock(SurveyDefinitionLoader.class);
        SurveyConfigStartupCheck check = new SurveyConfigStartupCheck(surveyRepository, loader);
        Survey active = survey(1L, "ONBOARDING");
        when(surveyRepository.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of(active));
        when(loader.load(active)).thenThrow(new IllegalStateException("broken config"));

        assertThatCode(() -> check.run(null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("startup check: cau hinh hop le -> khong nem loi")
    void startupCheckAcceptsValidConfiguration() {
        SurveyRepository surveyRepository = mock(SurveyRepository.class);
        SurveyDefinitionLoader loader = mock(SurveyDefinitionLoader.class);
        SurveyConfigStartupCheck check = new SurveyConfigStartupCheck(surveyRepository, loader);
        Survey active = survey(1L, "ONBOARDING");
        when(surveyRepository.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of(active));
        when(loader.load(active)).thenReturn(SurveyFixtures.onboarding());

        assertThatCode(() -> check.run(null)).doesNotThrowAnyException();
    }

    // --------------------------------------------------- BenchmarkSurveyStartupSync

    @Test
    @DisplayName("startup sync: dong bo bat loi -> log loi, khong chan khoi dong")
    void startupSyncSwallowsFailure() {
        LevelBenchmarkService levelBenchmarks = mock(LevelBenchmarkService.class);
        BenchmarkSurveySync surveySync = mock(BenchmarkSurveySync.class);
        BenchmarkSurveyStartupSync startupSync = new BenchmarkSurveyStartupSync(levelBenchmarks, surveySync);
        when(levelBenchmarks.getConfiguration()).thenReturn(
                new BenchmarkConfiguration(List.of(), List.of(), List.of()));
        org.mockito.Mockito.doThrow(new IllegalStateException("boom"))
                .when(surveySync).sync(any(), any(), any());

        assertThatCode(() -> startupSync.run(null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("startup sync: dong bo thanh cong -> goi sync voi danh sach bai")
    void startupSyncDelegatesToSurveySync() {
        LevelBenchmarkService levelBenchmarks = mock(LevelBenchmarkService.class);
        BenchmarkSurveySync surveySync = mock(BenchmarkSurveySync.class);
        BenchmarkSurveyStartupSync startupSync = new BenchmarkSurveyStartupSync(levelBenchmarks, surveySync);
        BenchmarkExercise exercise = new BenchmarkExercise("PUSH_UP_MAX_REPS", "EX_PUSH_UP",
                "Push-up", "REPS", "reps", 10, 20, true);
        when(levelBenchmarks.getConfiguration()).thenReturn(
                new BenchmarkConfiguration(List.of(exercise), List.of(), List.of()));

        startupSync.run(null);

        ArgumentCaptor<List<BenchmarkExercise>> captor = ArgumentCaptor.forClass(List.class);
        verify(surveySync).sync(captor.capture(), any(), any());
        assertThat(captor.getValue()).extracting(BenchmarkExercise::slot).containsExactly("PUSH_UP_MAX_REPS");
    }

    // --------------------------------------------------- BenchmarkSurveySync branches

    @Test
    @DisplayName("sync: survey DRAFT cung duoc dong bo")
    void syncAlsoProcessesDraftSurveys() {
        Survey draft = survey(2L, "ONBOARDING_DRAFT");
        draft.setStatus(Survey.Status.DRAFT);
        SurveyStep levelTest = step(9L, 2L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        when(surveys.findByStatus(Survey.Status.DRAFT)).thenReturn(List.of(draft));
        when(surveys.findByIdForUpdate(2L)).thenReturn(Optional.of(draft));
        when(steps.findBySurveyIdOrderBySortOrderAsc(2L)).thenReturn(List.of(levelTest));
        when(stepQuestions.findAllByStepId(9L)).thenReturn(List.of());

        sync.sync(List.of(), List.of(), null);

        verify(steps).findBySurveyIdOrderBySortOrderAsc(2L);
    }

    @Test
    @DisplayName("sync: slot bi go nhung van duoc cau hinh -> bo qua, khong go lien ket")
    void syncKeepsSlotThatIsStillConfigured() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        Survey active = levelTest.getSurvey();
        when(surveys.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of(active));
        when(surveys.findByIdForUpdate(1L)).thenReturn(Optional.of(active));
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(levelTest));

        AssessmentQuestion question = new AssessmentQuestion();
        question.setId(100L);
        question.setQuestionCode("PUSH_UP_MAX_REPS");
        question.setQuestionType("NUMBER");
        question.setStatus(ConfigStatus.ACTIVE);
        SurveyStepQuestion existing = new SurveyStepQuestion();
        existing.setId(1L);
        existing.setStep(levelTest);
        existing.setQuestion(question);
        existing.setSortOrder(1);
        existing.setActive(true);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of(existing));
        when(questions.findByQuestionCode("PUSH_UP_MAX_REPS")).thenReturn(Optional.of(question));

        // "PUSH_UP_MAX_REPS" vua duoc cau hinh (wanted) va cung nam trong removedSlots -> phai bo qua.
        sync.sync(List.of(new BenchmarkExercise("PUSH_UP_MAX_REPS", "EX", "Push-up", "REPS", "reps", 10, 20, true)),
                List.of("PUSH_UP_MAX_REPS"), null);

        verify(stepQuestions, org.mockito.Mockito.never()).delete(existing);
    }

    @Test
    @DisplayName("sync: slot bi go va cau hinh rong -> go lien ket chua tra loi")
    void syncRemovesSlotWhenConfigurationIsEmpty() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        Survey active = levelTest.getSurvey();
        when(surveys.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of(active));
        when(surveys.findByIdForUpdate(1L)).thenReturn(Optional.of(active));
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(levelTest));

        AssessmentQuestion question = new AssessmentQuestion();
        question.setId(100L);
        question.setQuestionCode("PUSH_UP_MAX_REPS");
        question.setQuestionType("NUMBER");
        question.setStatus(ConfigStatus.ACTIVE);
        SurveyStepQuestion existing = new SurveyStepQuestion();
        existing.setId(1L);
        existing.setStep(levelTest);
        existing.setQuestion(question);
        existing.setSortOrder(1);
        existing.setActive(true);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of(existing));
        when(answers.findAnsweredQuestionIds(anyLong(), anyList())).thenReturn(List.of());

        sync.sync(List.of(), List.of("PUSH_UP_MAX_REPS"), null);

        verify(stepQuestions).delete(existing);
    }
}
