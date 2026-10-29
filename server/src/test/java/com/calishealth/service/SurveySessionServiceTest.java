package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.AnswerItem;
import com.calishealth.dtos.SurveyDtos.LevelAssessment;
import com.calishealth.dtos.SurveyDtos.SaveAnswersRequest;
import com.calishealth.dtos.SurveyDtos.SessionResponse;
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
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SurveySessionServiceTest {
    private static final String EMAIL = "member@example.com";

    private final SurveySessionRepository sessions = mock(SurveySessionRepository.class);
    private final AssessmentAnswerRepository answers = mock(AssessmentAnswerRepository.class);
    private final AssessmentQuestionRepository questions = mock(AssessmentQuestionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final SurveyService surveys = mock(SurveyService.class);
    private final SurveyDefinitionLoader loader = mock(SurveyDefinitionLoader.class);
    private final LevelAssessmentService levels = mock(LevelAssessmentService.class);
    private final SurveyDefinition definition = SurveyFixtures.onboarding();
    private final List<AssessmentAnswer> store = new ArrayList<>();

    private SurveySessionService service;
    private SurveySession session;

    @BeforeEach
    void setUp() {
        service = new SurveySessionService(sessions, answers, questions, users, surveys, loader, SurveyFixtures.registry(),
                mock(LevelBenchmarkService.class), levels);

        User user = user(1L, EMAIL);
        Survey survey = new Survey();
        survey.setId(1L);
        survey.setSurveyCode("TEST_SURVEY");
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
        lenient().doAnswer(i -> store.remove((AssessmentAnswer) i.getArgument(0))).when(answers).delete(any());
        lenient().when(questions.getReferenceById(anyLong())).thenAnswer(i -> questionEntity(i.getArgument(0)));
        lenient().when(questions.existsByQuestionCode("SECRET_QUESTION")).thenReturn(true);
    }

    private static User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        return user;
    }

    private AssessmentQuestion questionEntity(Long id) {
        StepQuestion stepQuestion = definition.allQuestions().filter(q -> q.question().id().equals(id)).findFirst().orElseThrow();
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

    private SessionResponse save(String step, Object... codeAndJson) {
        return service.saveStepAnswers(EMAIL, 10L, step, request(codeAndJson));
    }

    private static SurveyException surveyError(Runnable call) {
        try {
            call.run();
        } catch (SurveyException exception) {
            return exception;
        }
        throw new AssertionError("Expected SurveyException");
    }

    private String storedValue(String code) {
        return store.stream().filter(a -> a.getQuestion().getQuestionCode().equals(code))
                .map(AssessmentAnswer::getAnswerValue).findFirst().orElse(null);
    }

    private void answerBodyStep() {
        save("BODY_INFORMATION", "GENDER", "\"MALE\"", "AGE", "22", "HEIGHT", "172.5");
    }

    @Test
    void savesValidStepAndReportsNextStep() {
        answerBodyStep();

        assertThat(store).hasSize(3);
        assertThat(storedValue("AGE")).isEqualTo("22");
        assertThat(storedValue("HEIGHT")).isEqualTo("172.5");

        SessionResponse view = service.get(EMAIL, 10L);
        assertThat(view.steps().get(0).complete()).isTrue();
        assertThat(view.currentStepCode()).isEqualTo("GOALS_AND_MOTIVATION");
    }

    @Test
    void updatingAnAnswerDoesNotDuplicateIt() {
        answerBodyStep();
        save("BODY_INFORMATION", "AGE", "23");

        assertThat(store).hasSize(3);
        assertThat(storedValue("AGE")).isEqualTo("23");
        assertThat(storedValue("GENDER")).isEqualTo("\"MALE\"");
    }

    @Test
    void invalidRequestSavesNothingAndListsEveryError() {
        SurveyException error = surveyError(() -> save("BODY_INFORMATION",
                "GENDER", "\"MALE\"",
                "AGE", "120",
                "GOAL_TYPE", "\"HEALTH\"",
                "SECRET_QUESTION", "1",
                "NOPE", "1"));

        assertThat(error.getCode()).isEqualTo("SURVEY_VALIDATION_FAILED");
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getErrors()).extracting(SurveyException.ErrorItem::code)
                .containsExactly("VALUE_OUT_OF_RANGE", "QUESTION_NOT_IN_STEP", "QUESTION_NOT_IN_SURVEY", "QUESTION_NOT_FOUND");
        assertThat(store).isEmpty();
    }

    @Test
    void rejectsDuplicateQuestionMissingValueAndClientSuppliedRules() {
        AnswerItem missingValue = new AnswerItem();
        missingValue.setQuestionCode("HEIGHT");
        AnswerItem withType = AnswerItem.of("GENDER", json("\"MALE\""));
        withType.addUnknownField("questionType", "TEXT");
        SaveAnswersRequest request = new SaveAnswersRequest(null, List.of(
                AnswerItem.of("AGE", json("22")), AnswerItem.of("AGE", json("23")), missingValue, withType));

        SurveyException error = surveyError(() -> service.saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", request));
        assertThat(error.getErrors()).extracting(SurveyException.ErrorItem::code)
                .containsExactly("DUPLICATE_QUESTION", "VALUE_MISSING", "UNKNOWN_FIELD");
        assertThat(store).isEmpty();
    }

    @Test
    void nullClearsAStoredAnswer() {
        answerBodyStep();
        save("BODY_INFORMATION", "HEIGHT", "null");

        assertThat(storedValue("HEIGHT")).isNull();
        assertThat(service.get(EMAIL, 10L).currentStepCode()).isEqualTo("BODY_INFORMATION");
    }

    @Test
    void conditionalQuestionUsesAnswersFromTheSameRequest() {
        SurveyException error = surveyError(() -> save("GOALS_AND_MOTIVATION",
                "GOAL_TYPE", "\"SKILLS\"", "HEALTH_GOAL", "\"LOSE_WEIGHT\""));
        assertThat(error.getErrors()).singleElement().extracting(SurveyException.ErrorItem::code)
                .isEqualTo("QUESTION_NOT_APPLICABLE");
        assertThat(store).isEmpty();

        save("GOALS_AND_MOTIVATION", "GOAL_TYPE", "\"SKILLS\"", "TRAINING_SKILLS", "[\"HANDSTAND\",\"MUSCLE_UP\"]");
        assertThat(storedValue("TRAINING_SKILLS")).isEqualTo("[\"MUSCLE_UP\",\"HANDSTAND\"]");
    }

    @Test
    void completeReportsMissingRequiredAnswersPerStep() {
        answerBodyStep();
        SurveyException error = surveyError(() -> service.complete(EMAIL, 10L));

        assertThat(error.getCode()).isEqualTo("SURVEY_INCOMPLETE");
        // HEALTH_GOAL / TRAINING_SKILLS chưa áp dụng vì GOAL_TYPE chưa trả lời; NOTE không bắt buộc
        assertThat(error.getErrors()).singleElement().satisfies(item -> {
            assertThat(item.stepCode()).isEqualTo("GOALS_AND_MOTIVATION");
            assertThat(item.questionCode()).isEqualTo("GOAL_TYPE");
            assertThat(item.code()).isEqualTo("MISSING_REQUIRED_ANSWER");
        });
        assertThat(session.getStatus()).isEqualTo(SurveySession.Status.IN_PROGRESS);
    }

    @Test
    void staleDependentAnswerBlocksCompletionUntilCleared() {
        answerBodyStep();
        save("GOALS_AND_MOTIVATION", "GOAL_TYPE", "\"HEALTH\"", "HEALTH_GOAL", "\"LOSE_WEIGHT\"");
        // đổi hướng: HEALTH_GOAL vẫn được giữ (không tự xóa) nhưng không còn áp dụng
        save("GOALS_AND_MOTIVATION", "GOAL_TYPE", "\"SKILLS\"", "TRAINING_SKILLS", "[\"PLANCHE\"]");
        assertThat(storedValue("HEALTH_GOAL")).isNotNull();

        SurveyException error = surveyError(() -> service.complete(EMAIL, 10L));
        assertThat(error.getErrors()).singleElement().extracting(SurveyException.ErrorItem::code)
                .isEqualTo("ANSWER_NOT_APPLICABLE");

        verify(levels, never()).assess(any(), any(), any());

        save("GOALS_AND_MOTIVATION", "HEALTH_GOAL", "null");
        SessionResponse completed = service.complete(EMAIL, 10L);
        assertThat(completed.status()).isEqualTo("COMPLETED");
        assertThat(session.getCompletedAt()).isNotNull();
        verify(levels).assess(eq(session), eq(definition), any());
    }

    @Test
    void resultIsOnlyAvailableForCompletedSessions() {
        assertThat(surveyError(() -> service.result(EMAIL, 10L)).getCode()).isEqualTo("SESSION_NOT_COMPLETED");

        answerBodyStep();
        save("GOALS_AND_MOTIVATION", "GOAL_TYPE", "\"HEALTH\"", "HEALTH_GOAL", "\"STAY_FIT\"");
        service.complete(EMAIL, 10L);
        LevelAssessment stored = new LevelAssessment("NONE", "NO_RULE_SET", null, List.of(), null, null,
                true, true, List.of(), null, LocalDateTime.now());
        when(levels.find(session)).thenReturn(Optional.of(stored));

        assertThat(service.result(EMAIL, 10L).assessment()).isSameAs(stored);
    }

    @Test
    void completedSessionCannotBeChanged() {
        answerBodyStep();
        save("GOALS_AND_MOTIVATION", "GOAL_TYPE", "\"HEALTH\"", "HEALTH_GOAL", "\"STAY_FIT\"");
        service.complete(EMAIL, 10L);

        assertThat(surveyError(() -> save("BODY_INFORMATION", "AGE", "30")).getCode()).isEqualTo("SESSION_COMPLETED");
        assertThat(surveyError(() -> service.complete(EMAIL, 10L)).getCode()).isEqualTo("SESSION_COMPLETED");
        assertThat(surveyError(() -> service.skip(EMAIL, 10L)).getCode()).isEqualTo("SESSION_COMPLETED");
    }

    @Test
    void skipKeepsAnswersAndBlocksEditsUntilResumed() {
        answerBodyStep();
        SessionResponse skipped = service.skip(EMAIL, 10L);

        assertThat(skipped.status()).isEqualTo("SKIPPED");
        assertThat(store).hasSize(3);
        assertThat(skipped.steps().get(0).questions()).allMatch(q -> q.answered());
        assertThat(surveyError(() -> save("BODY_INFORMATION", "AGE", "30")).getCode()).isEqualTo("SESSION_SKIPPED");

        when(sessions.findByUserAndSurveyCode(1L, "TEST_SURVEY")).thenReturn(List.of(session));
        assertThat(service.resume(EMAIL, 10L).status()).isEqualTo("IN_PROGRESS");
        save("BODY_INFORMATION", "AGE", "30");
        assertThat(storedValue("AGE")).isEqualTo("30");
    }

    @Test
    void anotherUsersSessionLooksLikeItDoesNotExist() {
        when(users.findByEmail("other@example.com")).thenReturn(Optional.of(user(2L, "other@example.com")));

        SurveyException error = surveyError(() -> service.get("other@example.com", 10L));
        assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(error.getCode()).isEqualTo("SESSION_NOT_FOUND");
        assertThatThrownBy(() -> service.saveStepAnswers("other@example.com", 10L, "BODY_INFORMATION",
                request("AGE", "22"))).isInstanceOf(SurveyException.class);
        assertThat(store).isEmpty();
    }

    @Test
    void unknownStepAndVersionMismatch() {
        assertThat(surveyError(() -> save("NOT_A_STEP", "AGE", "22")).getCode()).isEqualTo("STEP_NOT_FOUND");

        SaveAnswersRequest stale = new SaveAnswersRequest(2, List.of(AnswerItem.of("AGE", json("22"))));
        assertThat(surveyError(() -> service.saveStepAnswers(EMAIL, 10L, "BODY_INFORMATION", stale)).getCode())
                .isEqualTo("SURVEY_VERSION_MISMATCH");
    }

    @Test
    void startReturnsExistingInProgressSession() {
        when(sessions.findByUserAndSurveyCode(1L, "TEST_SURVEY")).thenReturn(List.of(session));
        SurveySessionService.StartResult result = service.start(EMAIL, "TEST_SURVEY");

        assertThat(result.created()).isFalse();
        assertThat(result.session().sessionId()).isEqualTo(10L);
    }
}
