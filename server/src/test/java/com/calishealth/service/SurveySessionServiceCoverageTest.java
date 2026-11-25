package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.AnswerItem;
import com.calishealth.dtos.SurveyDtos.LevelAssessment;
import com.calishealth.dtos.SurveyDtos.LevelItem;
import com.calishealth.dtos.SurveyDtos.PlanDayItem;
import com.calishealth.dtos.SurveyDtos.PlanResponse;
import com.calishealth.dtos.SurveyDtos.SaveAnswersRequest;
import com.calishealth.dtos.SurveyDtos.SessionSummaryResponse;
import com.calishealth.exception.SurveyException;
import com.calishealth.models.AssessmentAnswer;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveySession;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.SurveySessionRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import com.calishealth.service.survey.SurveyFixtures;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import com.calishealth.service.survey.level.LevelAssessmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link SurveySessionService}: vòng đời phiên (start/skip/resume/reopen),
 * danh sách phiên, kết quả và kế hoạch.
 */
class SurveySessionServiceCoverageTest {

    private static final String EMAIL = "member@example.com";
    private static final String CODE = "TEST_SURVEY";

    private SurveySessionRepository sessions;
    private AssessmentAnswerRepository answers;
    private AssessmentQuestionRepository questions;
    private UserRepository users;
    private SurveyService surveys;
    private SurveyDefinitionLoader loader;
    private LevelBenchmarkService levelBenchmarks;
    private LevelAssessmentService levels;

    private SurveyDefinition definition;
    private List<AssessmentAnswer> store;
    private User user;
    private Survey survey;
    private SurveySession session;

    @BeforeEach
    void setUp() {
        sessions = mock(SurveySessionRepository.class);
        answers = mock(AssessmentAnswerRepository.class);
        questions = mock(AssessmentQuestionRepository.class);
        users = mock(UserRepository.class);
        surveys = mock(SurveyService.class);
        loader = mock(SurveyDefinitionLoader.class);
        levelBenchmarks = mock(LevelBenchmarkService.class);
        levels = mock(LevelAssessmentService.class);

        definition = SurveyFixtures.onboarding();
        store = new ArrayList<>();

        user = new User();
        user.setId(1L);
        user.setEmail(EMAIL);

        survey = new Survey();
        survey.setId(1L);
        survey.setSurveyCode(CODE);
        survey.setVersion(1);

        session = new SurveySession();
        session.setId(10L);
        session.setUser(user);
        session.setSurvey(survey);
        session.setSurveyVersion(1);
        session.setStatus(SurveySession.Status.IN_PROGRESS);
        session.setStartedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());

        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        lenient().when(sessions.findByIdForUpdate(10L)).thenReturn(Optional.of(session));
        lenient().when(sessions.findWithSurveyById(10L)).thenReturn(Optional.of(session));
        lenient().when(loader.load(any())).thenReturn(definition);
        lenient().when(answers.findBySessionId(anyLong())).thenAnswer(i -> new ArrayList<>(store));
        lenient().when(answers.save(any())).thenAnswer(i -> {
            store.add(i.getArgument(0));
            return i.getArgument(0);
        });
        lenient().when(questions.getReferenceById(anyLong())).thenAnswer(i -> questionEntity(i.getArgument(0)));
        lenient().doAnswer(i -> store.remove((AssessmentAnswer) i.getArgument(0))).when(answers).delete(any());
        lenient().when(sessions.findByUserAndSurveyCode(anyLong(), anyString())).thenReturn(List.of());
    }

    private SurveySessionService service() {
        return new SurveySessionService(sessions, answers, questions, users, surveys, loader,
                SurveyFixtures.registry(), levelBenchmarks, levels);
    }

    private AssessmentQuestion questionEntity(Long id) {
        StepQuestion stepQuestion = definition.allQuestions()
                .filter(q -> q.question().id().equals(id)).findFirst().orElseThrow();
        AssessmentQuestion entity = new AssessmentQuestion();
        entity.setId(id);
        entity.setQuestionCode(stepQuestion.question().code());
        return entity;
    }

    private static SaveAnswersRequest request(Object... codeAndJson) {
        List<AnswerItem> items = new ArrayList<>();
        for (int i = 0; i < codeAndJson.length; i += 2) {
            items.add(AnswerItem.of((String) codeAndJson[i], json((String) codeAndJson[i + 1])));
        }
        return new SaveAnswersRequest(null, items);
    }

    private void answerAll() {
        service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION",
                request("GENDER", "\"MALE\"", "AGE", "22", "HEIGHT", "172"));
        service().saveStepAnswers(EMAIL, 10L, "GOALS_AND_MOTIVATION",
                request("GOAL_TYPE", "\"HEALTH\"", "HEALTH_GOAL", "\"STAY_FIT\""));
    }

    private static SurveyException surveyError(Runnable call) {
        try {
            call.run();
        } catch (SurveyException exception) {
            return exception;
        }
        throw new AssertionError("Expected SurveyException");
    }

    @Test
    @DisplayName("start: khong co phiEN dang chay -> tao phiEN moi")
    void startCreatesNewSession() {
        when(surveys.findActiveSurvey(CODE)).thenReturn(survey);

        SurveySessionService.StartResult result = service().start(EMAIL, CODE);

        assertThat(result.created()).isTrue();
        assertThat(result.session().status()).isEqualTo("IN_PROGRESS");
        verify(sessions).saveAndFlush(any(SurveySession.class));
    }

    @Test
    @DisplayName("start: request song song -> nem conflict")
    void startFailsWhenSessionAlreadyCreated() {
        when(surveys.findActiveSurvey(CODE)).thenReturn(survey);
        when(sessions.saveAndFlush(any(SurveySession.class)))
                .thenThrow(new DataIntegrityViolationException("dup"));

        SurveyException error = surveyError(() -> service().start(EMAIL, CODE));

        assertThat(error.getCode()).isEqualTo("ACTIVE_SESSION_EXISTS");
    }

    @Test
    @DisplayName("list: tra ve danh sach phien cua member")
    void listReturnsSummaries() {
        session.setStatus(SurveySession.Status.COMPLETED);
        session.setCompletedAt(LocalDateTime.now());
        when(sessions.findByUserAndSurveyCode(1L, CODE)).thenReturn(List.of(session));

        List<SessionSummaryResponse> summaries = service().list(EMAIL, CODE);

        assertThat(summaries).hasSize(1);
        assertThat(summaries.get(0).sessionId()).isEqualTo(10L);
        assertThat(summaries.get(0).status()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("saveStepAnswers: step khong ton tai -> STEP_NOT_FOUND")
    void saveRejectsUnknownStep() {
        SurveyException error = surveyError(() ->
                service().saveStepAnswers(EMAIL, 10L, "NOPE", request("AGE", "22")));

        assertThat(error.getCode()).isEqualTo("STEP_NOT_FOUND");
    }

    @Test
    @DisplayName("saveStepAnswers: step khong active -> STEP_INACTIVE")
    void saveRejectsInactiveStep() {
        SurveyDefinition inactive = new SurveyDefinition(1L, CODE, "Test", null, 1, List.of(
                new com.calishealth.service.survey.definition.StepDefinition(
                        "BODY_INFORMATION", "Body", null, 1, false, List.of())));
        when(loader.load(any())).thenReturn(inactive);

        SurveyException error = surveyError(() ->
                service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", request("AGE", "22")));

        assertThat(error.getCode()).isEqualTo("STEP_INACTIVE");
    }

    @Test
    @DisplayName("saveStepAnswers: cau hoi khong active -> QUESTION_INACTIVE")
    void saveRejectsInactiveQuestion() {
        SurveyDefinition withInactive = new SurveyDefinition(1L, CODE, "Test", null, 1, List.of(
                new com.calishealth.service.survey.definition.StepDefinition(
                        "BODY_INFORMATION", "Body", null, 1, true,
                        List.of(new StepQuestion(
                                definition.allQuestions().filter(q -> q.question().code().equals("AGE"))
                                        .findFirst().orElseThrow().question(),
                                1, false, null, null)))));
        when(loader.load(any())).thenReturn(withInactive);

        SurveyException error = surveyError(() ->
                service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", request("AGE", "22")));

        assertThat(error.getErrors()).extracting(SurveyException.ErrorItem::code)
                .containsExactly("QUESTION_INACTIVE");
    }

    @Test
    @DisplayName("saveStepAnswers: loai cau hoi khong ho tro -> loi server")
    void saveFailsOnUnsupportedType() {
        com.calishealth.service.survey.definition.QuestionDefinition unsupported =
                new com.calishealth.service.survey.definition.QuestionDefinition(
                        999L, "WEIRD", "Weird", null, "WEIRD_TYPE", true, null, null, null, null, true, List.of());
        SurveyDefinition withUnsupported = new SurveyDefinition(1L, CODE, "Test", null, 1, List.of(
                new com.calishealth.service.survey.definition.StepDefinition(
                        "BODY_INFORMATION", "Body", null, 1, true,
                        List.of(new StepQuestion(unsupported, 1, true, null, null)))));
        when(loader.load(any())).thenReturn(withUnsupported);

        assertThatThrownBy(() -> service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION",
                request("WEIRD", "\"x\"")))
                .isInstanceOf(SurveyException.class)
                .satisfies(ex -> assertThat(((SurveyException) ex).getCode())
                        .isEqualTo("UNSUPPORTED_QUESTION_TYPE"));
    }

    @Test
    @DisplayName("saveStepAnswers: gia tri null -> xoa cau tra loi da luu")
    void saveNullDeletesStoredAnswer() {
        service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", request("AGE", "22"));
        assertThat(store).hasSize(1);

        service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", request("AGE", "null"));

        assertThat(store).isEmpty();
    }

    @Test
    @DisplayName("saveStepAnswers: sua cau tra loi da co -> cap nhat gia tri")
    void saveUpdatesExistingAnswer() {
        service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", request("AGE", "22"));
        service().saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", request("AGE", "23"));

        assertThat(store).hasSize(1);
        assertThat(store.get(0).getAnswerValue()).isEqualTo("23");
    }

    @Test
    @DisplayName("complete: phiEN chua hoan thanh -> SESSION_NOT_COMPLETED")
    void resultRequiresCompletedSession() {
        SurveyException error = surveyError(() -> service().result(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("SESSION_NOT_COMPLETED");
    }

    @Test
    @DisplayName("result: chua cham -> cham bu va tra ve ket qua")
    void resultAssessesWhenMissing() {
        session.setStatus(SurveySession.Status.COMPLETED);
        session.setCompletedAt(LocalDateTime.now());
        when(levels.find(session)).thenReturn(Optional.empty());
        LevelAssessment assessed = new LevelAssessment("RULES", null,
                new LevelItem(1L, "Beginner", 1), List.of(), null, "summary",
                true, true, List.of(), null, LocalDateTime.now());
        when(levels.assess(any(), any(), any())).thenReturn(assessed);

        var result = service().result(EMAIL, 10L);

        assertThat(result.assessment()).isSameAs(assessed);
        verify(levels).assess(any(), any(), any());
    }

    @Test
    @DisplayName("startPlan: phiEN chua hoan thanh -> conflict")
    void startPlanRequiresCompletedSession() {
        SurveyException error = surveyError(() -> service().startPlan(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("SESSION_NOT_COMPLETED");
    }

    @Test
    @DisplayName("startPlan: chua co ke hoach -> PLAN_NOT_AVAILABLE")
    void startPlanRequiresPlan() {
        session.setStatus(SurveySession.Status.COMPLETED);
        when(levels.find(session)).thenReturn(Optional.of(new LevelAssessment(
                "RULES", null, new LevelItem(1L, "Beginner", 1), List.of(), null, null,
                true, true, List.of(), null, LocalDateTime.now())));

        SurveyException error = surveyError(() -> service().startPlan(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("PLAN_NOT_AVAILABLE");
    }

    @Test
    @DisplayName("startPlan: co ke hoach -> kich hoat ke hoach")
    void startPlanActivatesPlan() {
        session.setStatus(SurveySession.Status.COMPLETED);
        PlanResponse plan = new PlanResponse("BASE", "desc", null, 4, 3, 45,
                List.of(new PlanDayItem("MON", "Full body", List.of())));
        when(levels.find(session)).thenReturn(Optional.of(new LevelAssessment(
                "RULES", null, new LevelItem(1L, "Beginner", 1), List.of(), null, null,
                true, true, List.of(), plan, LocalDateTime.now())));

        var response = service().startPlan(EMAIL, 10L);

        assertThat(response.planName()).isEqualTo("BASE");
        assertThat(response.sessionsPerWeek()).isEqualTo(3);
        assertThat(response.levelName()).isEqualTo("Beginner");
        verify(levels).activatePlan(eq(1L), any());
    }

    @Test
    @DisplayName("startPlan: ket qua khong ton tai -> RESULT_NOT_AVAILABLE")
    void startPlanRequiresResult() {
        session.setStatus(SurveySession.Status.COMPLETED);
        when(levels.find(session)).thenReturn(Optional.empty());

        SurveyException error = surveyError(() -> service().startPlan(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("RESULT_NOT_AVAILABLE");
    }

    @Test
    @DisplayName("reopen: phiEN da hoan thanh -> mo lai cho sua")
    void reopenCompletedSession() {
        session.setStatus(SurveySession.Status.COMPLETED);
        session.setCompletedAt(LocalDateTime.now());

        var response = service().reopen(EMAIL, 10L);

        assertThat(response.status()).isEqualTo("IN_PROGRESS");
        assertThat(session.getCompletedAt()).isNull();
        verify(levels).clearResult(session);
    }

    @Test
    @DisplayName("reopen: co phien dang chay khac -> conflict")
    void reopenRejectsWhenAnotherInProgressExists() {
        session.setStatus(SurveySession.Status.COMPLETED);
        SurveySession other = new SurveySession();
        other.setId(11L);
        other.setUser(user);
        other.setSurvey(survey);
        other.setStatus(SurveySession.Status.IN_PROGRESS);
        when(sessions.findByUserAndSurveyCode(1L, CODE)).thenReturn(List.of(other));

        SurveyException error = surveyError(() -> service().reopen(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("ACTIVE_SESSION_EXISTS");
    }

    @Test
    @DisplayName("reopen: phien chua hoan thanh -> INVALID_SESSION_STATE")
    void reopenRejectsInProgressSession() {
        SurveyException error = surveyError(() -> service().reopen(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("INVALID_SESSION_STATE");
    }

    @Test
    @DisplayName("resume: phien da bo qua -> chuyen lai IN_PROGRESS")
    void resumeSkippedSession() {
        session.setStatus(SurveySession.Status.SKIPPED);
        session.setSkippedAt(LocalDateTime.now());

        var response = service().resume(EMAIL, 10L);

        assertThat(response.status()).isEqualTo("IN_PROGRESS");
        assertThat(session.getSkippedAt()).isNull();
    }

    @Test
    @DisplayName("resume: phien dang chay -> conflict")
    void resumeRejectsRunningSession() {
        SurveyException error = surveyError(() -> service().resume(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("INVALID_SESSION_STATE");
    }

    @Test
    @DisplayName("resume: co phien dang chay khac -> conflict")
    void resumeRejectsWhenAnotherInProgressExists() {
        session.setStatus(SurveySession.Status.SKIPPED);
        SurveySession other = new SurveySession();
        other.setId(11L);
        other.setUser(user);
        other.setSurvey(survey);
        other.setStatus(SurveySession.Status.IN_PROGRESS);
        when(sessions.findByUserAndSurveyCode(1L, CODE)).thenReturn(List.of(other));

        SurveyException error = surveyError(() -> service().resume(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("ACTIVE_SESSION_EXISTS");
    }

    @Test
    @DisplayName("resume: request song song -> conflict")
    void resumeFailsWhenSessionAlreadyCreated() {
        session.setStatus(SurveySession.Status.SKIPPED);
        when(sessions.saveAndFlush(any(SurveySession.class)))
                .thenThrow(new DataIntegrityViolationException("dup"));

        SurveyException error = surveyError(() -> service().resume(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("ACTIVE_SESSION_EXISTS");
    }

    @Test
    @DisplayName("skip: chuyen phien sang SKIPPED")
    void skipMarksSessionSkipped() {
        var response = service().skip(EMAIL, 10L);

        assertThat(response.status()).isEqualTo("SKIPPED");
        assertThat(session.getSkippedAt()).isNotNull();
    }

    @Test
    @DisplayName("user khong ton tai -> 401")
    void unknownUserIsRejected() {
        when(users.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().get("ghost@x.vn", 10L))
                .isInstanceOf(SurveyException.class)
                .satisfies(ex -> assertThat(((SurveyException) ex).getStatus().value()).isEqualTo(401));
    }

    @Test
    @DisplayName("complete: survey co ma ONBOARD -> gan level theo benchmark")
    void completeAssignsBenchmarkLevel() {
        survey.setSurveyCode("ONBOARDING_LEVEL_TEST");
        when(levelBenchmarks.benchmarkSlots()).thenReturn(List.of("PUSHUP_REPS"));
        when(levelBenchmarks.assignLevelFromOnboarding(anyLong(), any())).thenReturn(Optional.empty());

        answerAll();
        service().complete(EMAIL, 10L);

        verify(levelBenchmarks).assignLevelFromOnboarding(eq(1L), any());
    }

    @Test
    @DisplayName("complete: benchmark loi -> van hoan thanh phien")
    void completeSurvivesBenchmarkFailure() {
        survey.setSurveyCode("ONBOARDING_LEVEL_TEST");
        when(levelBenchmarks.benchmarkSlots()).thenReturn(List.of("PUSHUP_REPS"));
        when(levelBenchmarks.assignLevelFromOnboarding(anyLong(), any()))
                .thenThrow(new RuntimeException("boom"));

        answerAll();
        var response = service().complete(EMAIL, 10L);

        assertThat(response.status()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("complete: khong phai survey ONBOARD -> khong gan benchmark level")
    void completeSkipsBenchmarkForOtherSurveys() {
        answerAll();
        service().complete(EMAIL, 10L);

        verify(levelBenchmarks, never()).assignLevelFromOnboarding(anyLong(), any());
    }
}
