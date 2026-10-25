package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.AnswerItem;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.dtos.SurveyStepManagementDtos.AvailableQuestionResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.PreviewCheckRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.PreviewCheckResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepPreviewResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepQuestionInput;
import com.calishealth.dtos.SurveyStepManagementDtos.StepQuestionItem;
import com.calishealth.exception.SurveyException.ErrorItem;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.service.survey.SurveyFixtures;
import com.calishealth.dtos.SurveyStepManagementDtos.ChangeStepStatusRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.CreateStepRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.ReorderStepsRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.StepDetailResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepListResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepSummaryResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateResultConfigRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateStepRequest;
import com.calishealth.exception.SurveyException;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.models.SurveyStepQuestion;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.repository.SurveyStepQuestionRepository;
import com.calishealth.repository.SurveyStepRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SurveyStepManagementServiceTest {
    private static final String EMAIL = "content@example.com";
    private static final String CODE = "TEST_SURVEY";

    private final SurveyRepository surveys = mock(SurveyRepository.class);
    private final SurveyStepRepository steps = mock(SurveyStepRepository.class);
    private final SurveyStepQuestionRepository stepQuestions = mock(SurveyStepQuestionRepository.class);
    private final AssessmentOptionRepository options = mock(AssessmentOptionRepository.class);
    private final AssessmentAnswerRepository answers = mock(AssessmentAnswerRepository.class);
    private final FitnessLevelRepository fitnessLevels = mock(FitnessLevelRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final SurveyDefinitionLoader loader = mock(SurveyDefinitionLoader.class);
    private final AssessmentQuestionRepository questions = mock(AssessmentQuestionRepository.class);

    /** "Bảng" survey_steps / survey_step_questions / assessment_questions trong bộ nhớ. */
    private final List<SurveyStep> stepStore = new ArrayList<>();
    private final List<SurveyStepQuestion> linkStore = new ArrayList<>();
    private final Map<String, AssessmentQuestion> bank = new LinkedHashMap<>();

    private SurveyStepManagementService service;
    private Survey survey;
    private SurveyStep body;
    private SurveyStep draft;
    private SurveyStep result;

    @BeforeEach
    void setUp() {
        service = new SurveyStepManagementService(surveys, steps, stepQuestions, questions, options, answers,
                fitnessLevels, users, loader, SurveyFixtures.registry());

        survey = new Survey();
        survey.setId(1L);
        survey.setSurveyCode(CODE);
        survey.setSurveyName("Test");
        survey.setVersion(1);
        survey.setStatus(Survey.Status.ACTIVE);

        body = step(11L, "BODY_INFORMATION", "Body information", SurveyStep.Type.QUESTIONS, SurveyStep.Status.ACTIVE, 1);
        draft = step(12L, "GOALS", "Goals and motivation", SurveyStep.Type.QUESTIONS, SurveyStep.Status.DRAFT, 2);
        result = step(13L, "RESULT", "Result and recommended plan", SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE, 3);
        linkStore.add(link(body, question(101L, "AGE", "NUMBER")));
        linkStore.add(link(body, question(102L, "GENDER", "SINGLE_SELECT")));

        User user = new User();
        user.setId(5L);
        user.setEmail(EMAIL);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        lenient().when(surveys.findBySurveyCodeAndStatus(CODE, Survey.Status.ACTIVE)).thenReturn(Optional.of(survey));
        lenient().when(surveys.findByIdForUpdate(1L)).thenReturn(Optional.of(survey));
        lenient().when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenAnswer(i -> stepStore.stream()
                .sorted(Comparator.comparingInt(SurveyStep::getSortOrder)).toList());
        lenient().when(steps.findById(anyLong())).thenAnswer(i -> stepStore.stream()
                .filter(s -> s.getId().equals(i.getArgument(0))).findFirst());
        lenient().when(steps.save(any())).thenAnswer(i -> {
            SurveyStep saved = i.getArgument(0);
            saved.setId(100L + stepStore.size());
            stepStore.add(saved);
            return saved;
        });
        lenient().when(stepQuestions.findAllBySurveyId(1L)).thenAnswer(i -> new ArrayList<>(linkStore));
        lenient().when(stepQuestions.findAllByStepId(anyLong())).thenAnswer(i -> linkStore.stream()
                .filter(l -> l.getStep().getId().equals(i.getArgument(0))).toList());
        lenient().when(loader.findProblems(any())).thenReturn(List.of());
        lenient().when(stepQuestions.save(any())).thenAnswer(i -> {
            SurveyStepQuestion saved = i.getArgument(0);
            if (!linkStore.contains(saved)) {
                linkStore.add(saved);
            }
            return saved;
        });
        lenient().doAnswer(i -> linkStore.remove((SurveyStepQuestion) i.getArgument(0)))
                .when(stepQuestions).delete(any());
        lenient().when(questions.findByQuestionCodeIn(anyCollection())).thenAnswer(i -> {
            Collection<String> codes = i.getArgument(0);
            return bank.values().stream().filter(q -> codes.contains(q.getQuestionCode())).toList();
        });
        lenient().when(questions.findByStatusOrderByQuestionCodeAsc(ConfigStatus.ACTIVE))
                .thenAnswer(i -> bank.values().stream().filter(q -> q.getStatus() == ConfigStatus.ACTIVE).toList());
    }

    private SurveyStep step(Long id, String code, String name, SurveyStep.Type type, SurveyStep.Status status, int order) {
        SurveyStep step = new SurveyStep();
        step.setId(id);
        step.setSurvey(survey);
        step.setStepCode(code);
        step.setStepName(name);
        step.setStepType(type);
        step.setStatus(status);
        step.setSortOrder(order);
        step.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        stepStore.add(step);
        return step;
    }

    private AssessmentQuestion question(Long id, String code, String type) {
        AssessmentQuestion question = new AssessmentQuestion();
        bank.put(code, question);
        question.setId(id);
        question.setQuestionCode(code);
        question.setQuestionText(code);
        question.setQuestionType(type);
        question.setStatus(ConfigStatus.ACTIVE);
        return question;
    }

    private static SurveyStepQuestion link(SurveyStep step, AssessmentQuestion question) {
        SurveyStepQuestion link = new SurveyStepQuestion();
        link.setStep(step);
        link.setQuestion(question);
        link.setSortOrder(1);
        return link;
    }

    private static void assertError(Runnable call, HttpStatus status, String code) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(SurveyException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(status);
                    assertThat(e.getCode()).isEqualTo(code);
                });
    }

    // ---------- List ----------

    @Test
    void listCountsStatusesAndSummarisesQuestions() {
        StepListResponse response = service.list(CODE, null, null, null);

        assertThat(response.counts().all()).isEqualTo(3);
        assertThat(response.counts().active()).isEqualTo(2);
        assertThat(response.counts().draft()).isEqualTo(1);
        assertThat(response.counts().inactive()).isZero();
        StepSummaryResponse first = response.steps().get(0);
        assertThat(first.position()).isEqualTo(1);
        assertThat(first.questionCount()).isEqualTo(2);
        assertThat(first.questionTypes()).containsExactly("NUMBER", "SINGLE_SELECT");
    }

    @Test
    void searchAndStatusFilterKeepTheOriginalStepNumber() {
        StepListResponse response = service.list(CODE, null, "  RESULT ", SurveyStep.Status.ACTIVE);

        assertThat(response.counts().all()).isEqualTo(1);
        assertThat(response.steps()).singleElement().satisfies(s -> {
            assertThat(s.stepCode()).isEqualTo("RESULT");
            assertThat(s.position()).isEqualTo(3);
        });
    }

    @Test
    void inactiveQuestionsAreNotCounted() {
        linkStore.get(0).getQuestion().setStatus(ConfigStatus.INACTIVE);
        linkStore.get(1).setActive(false);

        assertThat(service.list(CODE, null, null, null).steps().get(0).questionCount()).isZero();
    }

    // ---------- Create ----------

    @Test
    void createPlacesNewDraftStepBeforeTheResultStep() {
        StepDetailResponse created = service.create(EMAIL, CODE, null,
                new CreateStepRequest("Current training routine", "Evaluate training", null, null));

        assertThat(created.step().stepCode()).isEqualTo("CURRENT_TRAINING_ROUTINE");
        assertThat(created.step().status()).isEqualTo("DRAFT");
        assertThat(created.step().position()).isEqualTo(3);
        assertThat(result.getSortOrder()).isEqualTo(4);
    }

    @Test
    void secondResultStepIsRejected() {
        assertError(() -> service.create(EMAIL, CODE, null, new CreateStepRequest("Another result", null, null,
                SurveyStep.Type.RESULT)), HttpStatus.CONFLICT, "RESULT_STEP_EXISTS");
    }

    @Test
    void duplicateNameOrCodeIsRejected() {
        assertError(() -> service.create(EMAIL, CODE, null, new CreateStepRequest(" body INFORMATION ", null, null, null)),
                HttpStatus.CONFLICT, "STEP_NAME_EXISTS");
        assertError(() -> service.create(EMAIL, CODE, null, new CreateStepRequest("New", null, "GOALS", null)),
                HttpStatus.CONFLICT, "STEP_CODE_EXISTS");
    }

    @Test
    void archivedSurveyIsReadOnly() {
        survey.setStatus(Survey.Status.ARCHIVED);
        when(surveys.findBySurveyCodeAndVersion(CODE, 1)).thenReturn(Optional.of(survey));

        assertError(() -> service.create(EMAIL, CODE, 1, new CreateStepRequest("New", null, null, null)),
                HttpStatus.CONFLICT, "SURVEY_ARCHIVED");
    }

    // ---------- Update ----------

    @Test
    void resultStepIsConfiguredNotEdited() {
        assertError(() -> service.update(EMAIL, CODE, null, 13L,
                        new UpdateStepRequest(0, "Result", null, SurveyStep.Status.ACTIVE, List.of())),
                HttpStatus.BAD_REQUEST, "RESULT_STEP_NOT_EDITABLE");
    }

    @Test
    void stepOfAnotherSurveyIsNotFound() {
        assertError(() -> service.get(CODE, null, 999L), HttpStatus.NOT_FOUND, "STEP_NOT_FOUND");
    }

    // ---------- Status ----------

    @Test
    void publishedStepCannotGoBackToDraft() {
        assertError(() -> service.changeStatus(EMAIL, CODE, null, 11L, new ChangeStepStatusRequest(SurveyStep.Status.DRAFT)),
                HttpStatus.CONFLICT, "INVALID_STATUS_TRANSITION");
    }

    @Test
    void stepWithoutActiveQuestionsCannotBeActivated() {
        assertError(() -> service.changeStatus(EMAIL, CODE, null, 12L, new ChangeStepStatusRequest(SurveyStep.Status.ACTIVE)),
                HttpStatus.CONFLICT, "STEP_HAS_NO_QUESTIONS");
        assertThat(draft.getStatus()).isEqualTo(SurveyStep.Status.DRAFT);
    }

    @Test
    void deactivatingAStepThatOtherQuestionsDependOnIsRejected() {
        when(loader.findProblems(any())).thenReturn(List.of(), List.of("Question X: condition references 'AGE'"));

        assertError(() -> service.changeStatus(EMAIL, CODE, null, 11L, new ChangeStepStatusRequest(SurveyStep.Status.INACTIVE)),
                HttpStatus.CONFLICT, "SURVEY_CONFIG_CONFLICT");
    }

    @Test
    void existingConfigurationProblemsDoNotBlockAChange() {
        when(loader.findProblems(any())).thenReturn(List.of("old problem"));

        StepDetailResponse response = service.changeStatus(EMAIL, CODE, null, 11L,
                new ChangeStepStatusRequest(SurveyStep.Status.INACTIVE));

        assertThat(response.step().status()).isEqualTo("INACTIVE");
        assertThat(body.getUpdatedBy().getEmail()).isEqualTo(EMAIL);
    }

    // ---------- Reorder ----------

    @Test
    void reorderUpdatesSortOrderWithoutTouchingUpdatedAt() {
        LocalDateTime before = body.getUpdatedAt();

        StepListResponse response = service.reorder(CODE, null, new ReorderStepsRequest(List.of(12L, 11L, 13L)));

        assertThat(response.steps()).extracting(StepSummaryResponse::stepCode)
                .containsExactly("GOALS", "BODY_INFORMATION", "RESULT");
        assertThat(body.getUpdatedAt()).isEqualTo(before);
    }

    @Test
    void reorderRejectsInvalidLists() {
        assertError(() -> service.reorder(CODE, null, new ReorderStepsRequest(List.of(11L, 13L, 12L))),
                HttpStatus.BAD_REQUEST, "RESULT_STEP_MUST_BE_LAST");
        assertError(() -> service.reorder(CODE, null, new ReorderStepsRequest(List.of(11L, 11L, 13L))),
                HttpStatus.BAD_REQUEST, "DUPLICATE_STEP");
        assertError(() -> service.reorder(CODE, null, new ReorderStepsRequest(List.of(11L, 13L))),
                HttpStatus.CONFLICT, "STEP_ORDER_STALE");
        assertThat(body.getSortOrder()).isEqualTo(1);
    }

    // ---------- Delete ----------

    @Test
    void deleteRules() {
        assertError(() -> service.delete(CODE, null, 13L), HttpStatus.CONFLICT, "RESULT_STEP_NOT_DELETABLE");
        assertError(() -> service.delete(CODE, null, 11L), HttpStatus.CONFLICT, "STEP_ACTIVE");

        body.setStatus(SurveyStep.Status.INACTIVE);
        when(answers.countBySurveyAndQuestions(any(), anyCollection())).thenReturn(3L);
        assertError(() -> service.delete(CODE, null, 11L), HttpStatus.CONFLICT, "STEP_IN_USE");
        verify(steps, never()).delete(any());
    }

    @Test
    void deleteCompactsTheRemainingOrder() {
        service.delete(CODE, null, 12L);

        verify(steps).delete(draft);
        assertThat(result.getSortOrder()).isEqualTo(2);
    }

    // ---------- Result config ----------

    @Test
    void resultConfigRejectsUnknownFitnessLevel() {
        when(fitnessLevels.existsById(9L)).thenReturn(false);
        ResultConfig config = new ResultConfig(true, true, 4, 3, 30, 9L);

        assertError(() -> service.updateResultConfig(EMAIL, CODE, null, 13L,
                new UpdateResultConfigRequest("Result", null, config)), HttpStatus.BAD_REQUEST, "FITNESS_LEVEL_NOT_FOUND");
    }

    @Test
    void onlyTheResultStepHasAResultConfig() {
        assertError(() -> service.getResultConfig(CODE, null, 11L), HttpStatus.BAD_REQUEST, "NOT_A_RESULT_STEP");
    }

    // ---------- Preview ----------

    @Test
    void previewNumbersTheStepAmongStepsMembersSee() {
        StepPreviewResponse preview = service.preview(CODE, null, 12L);

        assertThat(preview.memberStepNumber()).isEqualTo(2);
        assertThat(preview.memberStepCount()).isEqualTo(2);
        assertThat(preview.visibleToMembers()).isFalse();

        StepPreviewResponse first = service.preview(CODE, null, 11L);
        assertThat(first.memberStepNumber()).isEqualTo(1);
        assertThat(first.memberStepCount()).isEqualTo(1);
        assertThat(first.questions()).extracting(q -> q.questionCode()).containsExactly("AGE", "GENDER");
    }

    @Test
    void previewCheckUsesTheMemberRulesWithoutSaving() {
        when(loader.loadUnvalidated(any())).thenReturn(SurveyFixtures.onboarding());

        PreviewCheckResponse response = service.previewCheck(CODE, null, 11L, new PreviewCheckRequest(List.of(
                AnswerItem.of("AGE", SurveyFixtures.json("150")),
                AnswerItem.of("HEIGHT", SurveyFixtures.json("172.5")),
                AnswerItem.of("SHOE_SIZE", SurveyFixtures.json("42")))));

        assertThat(response.valid()).isFalse();
        assertThat(response.errors()).extracting(ErrorItem::questionCode, ErrorItem::code).containsExactlyInAnyOrder(
                tuple("AGE", "VALUE_OUT_OF_RANGE"),
                tuple("SHOE_SIZE", "QUESTION_NOT_IN_STEP"),
                tuple("GENDER", "MISSING_REQUIRED_ANSWER"));
        verify(answers, never()).save(any());
    }

    @Test
    void previewCheckAppliesConditionsInsideTheStep() {
        when(loader.loadUnvalidated(any())).thenReturn(SurveyFixtures.onboarding());
        draft.setStepCode("GOALS_AND_MOTIVATION");

        PreviewCheckResponse hidden = service.previewCheck(CODE, null, 12L, new PreviewCheckRequest(List.of(
                AnswerItem.of("GOAL_TYPE", SurveyFixtures.json("\"HEALTH\"")),
                AnswerItem.of("HEALTH_GOAL", SurveyFixtures.json("\"STAY_FIT\"")),
                AnswerItem.of("TRAINING_SKILLS", SurveyFixtures.json("[\"PLANCHE\"]")))));
        assertThat(hidden.errors()).extracting(ErrorItem::questionCode, ErrorItem::code)
                .containsExactly(tuple("TRAINING_SKILLS", "QUESTION_NOT_APPLICABLE"));

        PreviewCheckResponse ok = service.previewCheck(CODE, null, 12L, new PreviewCheckRequest(List.of(
                AnswerItem.of("GOAL_TYPE", SurveyFixtures.json("\"SKILLS\"")),
                AnswerItem.of("TRAINING_SKILLS", SurveyFixtures.json("[\"PLANCHE\"]")))));
        assertThat(ok.valid()).isTrue();
    }

    // ---------- Update step (Save changes) ----------

    private UpdateStepRequest edit(SurveyStep.Status status, StepQuestionInput... inputs) {
        return new UpdateStepRequest(body.getRevision(), "Body information", "Basic measurements.", status,
                List.of(inputs));
    }

    @Test
    void saveChangesReordersAddsAndRemovesQuestionsInOneGo() {
        SurveyStepQuestion age = linkStore.get(0);
        SurveyStepQuestion gender = linkStore.get(1);
        question(103L, "HEIGHT", "NUMBER");
        when(answers.findAnsweredQuestionIds(any(), anyCollection())).thenReturn(List.of(102L));

        StepDetailResponse response = service.update(EMAIL, CODE, null, 11L, edit(SurveyStep.Status.ACTIVE,
                new StepQuestionInput("HEIGHT", true), new StepQuestionInput("AGE", false)));

        assertThat(response.questions()).extracting(StepQuestionItem::questionCode, StepQuestionItem::active)
                .containsExactly(tuple("HEIGHT", true), tuple("AGE", true), tuple("GENDER", false));
        assertThat(response.questions().get(0).required()).isTrue();
        assertThat(age.getRequired()).as("same as the question bank -> no override").isNull();
        assertThat(gender.isActive()).as("answered question is kept but hidden").isFalse();
        assertThat(response.step().revision()).isEqualTo(1);
        assertThat(response.step().description()).isEqualTo("Basic measurements.");
    }

    @Test
    void removedQuestionWithoutAnswersIsUnlinked() {
        SurveyStepQuestion gender = linkStore.get(1);

        service.update(EMAIL, CODE, null, 11L, edit(SurveyStep.Status.ACTIVE, new StepQuestionInput("AGE", true)));

        verify(stepQuestions).delete(gender);
        assertThat(linkStore.get(0).getRequired()).isTrue();
    }

    @Test
    void staleRevisionIsRejected() {
        body.setRevision(3);

        assertError(() -> service.update(EMAIL, CODE, null, 11L, new UpdateStepRequest(2, "Body information", null,
                        SurveyStep.Status.ACTIVE, List.of(new StepQuestionInput("AGE", true)))),
                HttpStatus.CONFLICT, "STEP_MODIFIED");
    }

    @Test
    void invalidQuestionsAreReportedTogether() {
        linkStore.add(link(draft, question(104L, "MOTIVATIONS", "MULTIPLE_SELECT")));

        assertThatThrownBy(() -> service.update(EMAIL, CODE, null, 11L, edit(SurveyStep.Status.ACTIVE,
                new StepQuestionInput("AGE", true), new StepQuestionInput("AGE", true),
                new StepQuestionInput("MOTIVATIONS", true), new StepQuestionInput("NOPE", true))))
                .isInstanceOfSatisfying(SurveyException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("INVALID_STEP_QUESTIONS");
                    assertThat(e.getErrors()).extracting(ErrorItem::questionCode, ErrorItem::code).containsExactly(
                            tuple("AGE", "DUPLICATE_QUESTION"),
                            tuple("MOTIVATIONS", "QUESTION_IN_OTHER_STEP"),
                            tuple("NOPE", "QUESTION_NOT_FOUND"));
                });
        assertThat(body.getRevision()).isZero();
    }

    @Test
    void activeStepCannotBeSavedWithoutQuestions() {
        assertError(() -> service.update(EMAIL, CODE, null, 11L, edit(SurveyStep.Status.ACTIVE)),
                HttpStatus.CONFLICT, "STEP_HAS_NO_QUESTIONS");
    }

    @Test
    void removingAQuestionThatAConditionUsesIsRejected() {
        when(loader.findProblems(any())).thenReturn(List.of(), List.of("Question X: condition references 'GENDER'"));

        assertError(() -> service.update(EMAIL, CODE, null, 11L, edit(SurveyStep.Status.ACTIVE,
                new StepQuestionInput("AGE", true))), HttpStatus.CONFLICT, "SURVEY_CONFIG_CONFLICT");
    }

    @Test
    void availableQuestionsSkipQuestionsUsedInOtherSteps() {
        question(103L, "HEIGHT", "NUMBER");
        linkStore.add(link(draft, question(104L, "MOTIVATIONS", "MULTIPLE_SELECT")));

        List<AvailableQuestionResponse> available = service.availableQuestions(CODE, null, 11L, null);

        assertThat(available).extracting(AvailableQuestionResponse::questionCode,
                        AvailableQuestionResponse::inCurrentStep)
                .containsExactly(tuple("AGE", true), tuple("GENDER", true), tuple("HEIGHT", false));
        assertThat(service.availableQuestions(CODE, null, 11L, "heig")).hasSize(1);
    }

    // ---------- Step code ----------

    @Test
    void generatedStepCodeIsNormalisedAndUnique() {
        assertThat(SurveyStepManagementService.generateStepCode("Mục tiêu & động lực", Set.of()))
                .isEqualTo("MUC_TIEU_DONG_LUC");
        assertThat(SurveyStepManagementService.generateStepCode("Level test", Set.of("LEVEL_TEST", "LEVEL_TEST_2")))
                .isEqualTo("LEVEL_TEST_3");
        assertThat(SurveyStepManagementService.generateStepCode("3 days", Set.of())).isEqualTo("STEP_3_DAYS");
        assertThat(SurveyStepManagementService.generateStepCode("!!!", Set.of())).isEqualTo("STEP");
    }
}
