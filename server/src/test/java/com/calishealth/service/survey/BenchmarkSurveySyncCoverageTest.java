package com.calishealth.service.survey;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link BenchmarkSurveySync}: đồng bộ bước Level test với bảng Exercise point rules.
 */
class BenchmarkSurveySyncCoverageTest {

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
        lenient().when(surveys.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of());
        lenient().when(surveys.findByStatus(Survey.Status.DRAFT)).thenReturn(List.of());
    }

    private static Survey survey(long id, String code) {
        Survey survey = new Survey();
        survey.setId(id);
        survey.setSurveyCode(code);
        survey.setVersion(1);
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

    private static AssessmentQuestion question(long id, String code, String type) {
        AssessmentQuestion question = new AssessmentQuestion();
        question.setId(id);
        question.setQuestionCode(code);
        question.setQuestionType(type);
        question.setStatus(ConfigStatus.ACTIVE);
        return question;
    }

    private static SurveyStepQuestion link(SurveyStep step, AssessmentQuestion question, int order, boolean active) {
        SurveyStepQuestion link = new SurveyStepQuestion();
        link.setId((long) order);
        link.setStep(step);
        link.setQuestion(question);
        link.setSortOrder(order);
        link.setActive(active);
        return link;
    }

    private static BenchmarkExercise exercise(String slot, String category) {
        return new BenchmarkExercise(slot, "EX_" + slot, "Exercise " + slot, category, "reps",
                10, 20, true);
    }

    private void stubSurvey(SurveyStep step) {
        Survey survey = step.getSurvey();
        when(surveys.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of(survey));
        when(surveys.findByIdForUpdate(survey.getId())).thenReturn(Optional.of(survey));
        when(steps.findBySurveyIdOrderBySortOrderAsc(survey.getId())).thenReturn(List.of(step));
    }

    @Test
    @DisplayName("sync: khong co survey -> khong lam gi")
    void syncWithoutSurveysDoesNothing() {
        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        verify(steps, never()).save(any());
    }

    @Test
    @DisplayName("sync: survey bi xoa -> bo qua")
    void syncSkipsDeletedSurvey() {
        Survey survey = survey(1L, "ONBOARDING");
        when(surveys.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of(survey));
        when(surveys.findByIdForUpdate(1L)).thenReturn(Optional.empty());

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        verify(steps, never()).save(any());
    }

    @Test
    @DisplayName("sync: khong co buoc LEVEL_TEST -> bo qua")
    void syncSkipsSurveysWithoutLevelTestStep() {
        Survey survey = survey(1L, "ONBOARDING");
        when(surveys.findByStatus(Survey.Status.ACTIVE)).thenReturn(List.of(survey));
        when(surveys.findByIdForUpdate(1L)).thenReturn(Optional.of(survey));
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(step(5L, 1L, "PROFILE")));

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        verify(stepQuestions, never()).save(any());
    }

    @Test
    @DisplayName("sync: cau hoi chua co -> tao moi va ghep vao buoc")
    void syncCreatesMissingQuestion() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of());
        when(questions.findByQuestionCode("PUSH_UP_MAX_REPS")).thenReturn(Optional.empty());
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> {
            AssessmentQuestion saved = inv.getArgument(0);
            saved.setId(100L);
            return saved;
        });
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(steps.save(any(SurveyStep.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        verify(questions).save(any(AssessmentQuestion.class));
        verify(stepQuestions).save(any(SurveyStepQuestion.class));
    }

    @Test
    @DisplayName("sync: cau hoi dang INACTIVE -> bat lai ACTIVE")
    void syncReactivatesInactiveQuestion() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        AssessmentQuestion question = question(100L, "PUSH_UP_MAX_REPS", "NUMBER");
        question.setStatus(ConfigStatus.INACTIVE);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of());
        when(questions.findByQuestionCode("PUSH_UP_MAX_REPS")).thenReturn(Optional.of(question));
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(steps.save(any(SurveyStep.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        assertThat(question.getStatus()).isEqualTo(ConfigStatus.ACTIVE);
        verify(questions).save(question);
    }

    @Test
    @DisplayName("sync: cau hoi sai kieu NUMBER -> bo qua")
    void syncSkipsWrongQuestionType() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of());
        when(questions.findByQuestionCode("PUSH_UP_MAX_REPS"))
                .thenReturn(Optional.of(question(100L, "PUSH_UP_MAX_REPS", "TEXT")));

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        verify(stepQuestions, never()).save(any());
    }

    @Test
    @DisplayName("sync: lien ket da inactive -> bat lai active")
    void syncReactivatesLink() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        AssessmentQuestion question = question(100L, "PUSH_UP_MAX_REPS", "NUMBER");
        SurveyStepQuestion existing = link(levelTest, question, 1, false);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of(existing));
        when(questions.findByQuestionCode("PUSH_UP_MAX_REPS")).thenReturn(Optional.of(question));
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(steps.save(any(SurveyStep.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        assertThat(existing.isActive()).isTrue();
        verify(stepQuestions).save(existing);
    }

    @Test
    @DisplayName("sync: slot bi go -> da co tra loi -> an lien ket")
    void syncHidesAnsweredRemovedSlot() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        AssessmentQuestion question = question(100L, "PUSH_UP_MAX_REPS", "NUMBER");
        SurveyStepQuestion existing = link(levelTest, question, 1, true);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of(existing));
        when(questions.findByQuestionCode("PUSH_UP_MAX_REPS")).thenReturn(Optional.of(question));
        when(answers.findAnsweredQuestionIds(anyLong(), anyList())).thenReturn(List.of(100L));
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(steps.save(any(SurveyStep.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(), List.of("PUSH_UP_MAX_REPS"), null);

        assertThat(existing.isActive()).isFalse();
        verify(stepQuestions, never()).delete(any());
    }

    @Test
    @DisplayName("sync: slot bi go -> chua co tra loi -> go lien ket")
    void syncDeletesUnansweredRemovedSlot() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        AssessmentQuestion question = question(100L, "PUSH_UP_MAX_REPS", "NUMBER");
        SurveyStepQuestion existing = link(levelTest, question, 1, true);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of(existing));
        when(answers.findAnsweredQuestionIds(anyLong(), anyList())).thenReturn(List.of());
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(steps.save(any(SurveyStep.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(), List.of("PUSH_UP_MAX_REPS"), null);

        verify(stepQuestions).delete(existing);
    }

    @Test
    @DisplayName("sync: cau hoi moc trong buoc ma khong ai dung -> go lien ket")
    void syncRemovesOrphanLinks() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        AssessmentQuestion question = question(100L, "PLANK_MAX_SECONDS", "NUMBER");
        SurveyStepQuestion existing = link(levelTest, question, 1, true);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of(existing));
        when(answers.findAnsweredQuestionIds(anyLong(), anyList())).thenReturn(List.of());
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(steps.save(any(SurveyStep.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        verify(stepQuestions).delete(existing);
    }

    @Test
    @DisplayName("sync: bai HOLD -> cau hoi donh vi giay")
    void syncCreatesHoldQuestion() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of());
        when(questions.findByQuestionCode("PLANK_MAX_SECONDS")).thenReturn(Optional.empty());
        when(questions.save(any(AssessmentQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(steps.save(any(SurveyStep.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(exercise("PLANK_MAX_SECONDS", "HOLD")), List.of(), null);

        org.mockito.ArgumentCaptor<AssessmentQuestion> captor =
                org.mockito.ArgumentCaptor.forClass(AssessmentQuestion.class);
        verify(questions).save(captor.capture());
        assertThat(captor.getValue().getUnit()).isEqualTo("sec");
        assertThat(captor.getValue().getQuestionText()).contains("hold");
    }

    @Test
    @DisplayName("sync: khong co gi thay doi -> khong luu buoc")
    void syncDoesNotTouchStepWhenNothingChanged() {
        SurveyStep levelTest = step(5L, 1L, BenchmarkSurveySync.LEVEL_TEST_STEP_CODE);
        stubSurvey(levelTest);
        AssessmentQuestion question = question(100L, "PUSH_UP_MAX_REPS", "NUMBER");
        question.setDisplayConfig("{\"label\":\"x\"}");
        SurveyStepQuestion existing = link(levelTest, question, 1, true);
        when(stepQuestions.findAllByStepId(5L)).thenReturn(List.of(existing));
        when(questions.findByQuestionCode("PUSH_UP_MAX_REPS")).thenReturn(Optional.of(question));
        when(stepQuestions.save(any(SurveyStepQuestion.class))).thenAnswer(inv -> inv.getArgument(0));

        sync.sync(List.of(exercise("PUSH_UP_MAX_REPS", "REPS")), List.of(), null);

        verify(steps, never()).save(any());
    }
}
