package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.AnswerItem;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.dtos.SurveyStepManagementDtos.ChangeStepStatusRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.CreateStepRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.PreviewCheckRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.QuestionContentInput;
import com.calishealth.dtos.SurveyStepManagementDtos.ResultConfigResponse;
import com.calishealth.dtos.SurveyStepManagementDtos.StepQuestionInput;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateResultConfigRequest;
import com.calishealth.dtos.SurveyStepManagementDtos.UpdateStepRequest;
import com.calishealth.exception.SurveyException;
import com.calishealth.exception.SurveyException.ErrorItem;
import com.calishealth.models.AssessmentOption;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.models.SurveyStepQuestion;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.repository.SurveyStepQuestionRepository;
import com.calishealth.repository.SurveyStepRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.survey.StepQuestionWriter;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import com.calishealth.service.survey.SurveyFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link SurveyStepManagementService}: các nhánh chưa được chạm tới
 * (preview của bước RESULT, lỗi của Preview check, cấu hình result-config, fallback khi resolve survey...).
 */
class SurveyStepManagementServiceCoverageTest {

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

    private final List<SurveyStep> stepStore = new ArrayList<>();
    private final List<SurveyStepQuestion> linkStore = new ArrayList<>();
    private final Map<String, AssessmentQuestion> bank = new LinkedHashMap<>();
    private final List<AssessmentOption> optionStore = new ArrayList<>();

    private SurveyStepManagementService service;
    private Survey survey;
    private SurveyStep body;
    private SurveyStep result;

    @BeforeEach
    void setUp() {
        service = new SurveyStepManagementService(surveys, steps, stepQuestions, questions, options, answers,
                fitnessLevels, users, loader, SurveyFixtures.registry(),
                new StepQuestionWriter(questions, options, answers, SurveyFixtures.registry()));

        survey = new Survey();
        survey.setId(1L);
        survey.setSurveyCode(CODE);
        survey.setSurveyName("Test");
        survey.setVersion(1);
        survey.setStatus(Survey.Status.ACTIVE);

        body = step(11L, "BODY_INFORMATION", "Body information", SurveyStep.Type.QUESTIONS,
                SurveyStep.Status.ACTIVE, 1);
        result = step(13L, "RESULT", "Result and recommended plan", SurveyStep.Type.RESULT,
                SurveyStep.Status.ACTIVE, 3);

        User user = new User();
        user.setId(5L);
        user.setEmail(EMAIL);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        lenient().when(surveys.findBySurveyCodeAndStatus(CODE, Survey.Status.ACTIVE))
                .thenReturn(Optional.of(survey));
        lenient().when(surveys.findByIdForUpdate(1L)).thenReturn(Optional.of(survey));
        lenient().when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenAnswer(i -> stepStore.stream()
                .sorted(Comparator.comparingInt(SurveyStep::getSortOrder)).toList());
        lenient().when(steps.findById(anyLong())).thenAnswer(i -> stepStore.stream()
                .filter(s -> s.getId().equals(i.getArgument(0))).findFirst());
        lenient().when(steps.save(any())).thenAnswer(i -> {
            SurveyStep saved = i.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(100L + stepStore.size());
            }
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
        lenient().when(questions.findByQuestionCodeIn(anyCollection())).thenAnswer(i -> {
            Collection<String> codes = i.getArgument(0);
            return bank.values().stream().filter(q -> codes.contains(q.getQuestionCode())).toList();
        });
        lenient().when(questions.findByStatusOrderByQuestionCodeAsc(ConfigStatus.ACTIVE))
                .thenAnswer(i -> bank.values().stream().filter(q -> q.getStatus() == ConfigStatus.ACTIVE).toList());
        lenient().when(questions.existsByQuestionCode(any())).thenAnswer(i -> bank.containsKey(i.<String>getArgument(0)));
        lenient().when(questions.save(any())).thenAnswer(i -> {
            AssessmentQuestion saved = i.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(500L + bank.size());
            }
            bank.put(saved.getQuestionCode(), saved);
            return saved;
        });
        lenient().when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenAnswer(i -> {
            Collection<Long> ids = i.getArgument(0);
            return optionStore.stream().filter(o -> ids.contains(o.getQuestion().getId()))
                    .sorted(Comparator.comparingInt(AssessmentOption::getSortOrder)).toList();
        });
        lenient().when(options.save(any())).thenAnswer(i -> {
            AssessmentOption saved = i.getArgument(0);
            if (!optionStore.contains(saved)) {
                optionStore.add(saved);
            }
            return saved;
        });
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
    }

    private SurveyStep step(Long id, String code, String name, SurveyStep.Type type, SurveyStep.Status status,
            int order) {
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
        question.setId(id);
        question.setQuestionCode(code);
        question.setQuestionText(code);
        question.setQuestionType(type);
        question.setStatus(ConfigStatus.ACTIVE);
        bank.put(code, question);
        return question;
    }

    private SurveyStepQuestion link(SurveyStep step, AssessmentQuestion question) {
        SurveyStepQuestion link = new SurveyStepQuestion();
        link.setStep(step);
        link.setQuestion(question);
        link.setSortOrder(1);
        linkStore.add(link);
        return link;
    }

    private static void assertError(Runnable call, HttpStatus status, String code) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(SurveyException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(status);
                    assertThat(e.getCode()).isEqualTo(code);
                });
    }

    // ------------------------------------------------------- list / detail

    @Test
    @DisplayName("list: search qua gioi han -> 400")
    void listRejectsLongSearch() {
        assertError(() -> service.list(CODE, null, "x".repeat(101), null),
                HttpStatus.BAD_REQUEST, "INVALID_REQUEST");
    }

    @Test
    @DisplayName("get: tra ve chi tiet buoc")
    void getReturnsStepDetail() {
        AssessmentQuestion age = question(101L, "AGE", "NUMBER");
        link(body, age);

        var detail = service.get(CODE, null, 11L);

        assertThat(detail.step().stepCode()).isEqualTo("BODY_INFORMATION");
        assertThat(detail.questions()).extracting(q -> q.questionCode()).containsExactly("AGE");
        assertThat(detail.resultConfig()).isNull();
    }

    @Test
    @DisplayName("resolve: survey khong co version -> 404")
    void resolveMissingSurvey() {
        when(surveys.findBySurveyCodeAndStatus(CODE, Survey.Status.ACTIVE)).thenReturn(Optional.empty());
        when(surveys.findFirstBySurveyCodeAndStatusOrderByVersionDesc(CODE, Survey.Status.DRAFT))
                .thenReturn(Optional.empty());

        assertError(() -> service.list(CODE, null, null, null), HttpStatus.NOT_FOUND, "SURVEY_NOT_FOUND");
    }

    @Test
    @DisplayName("resolve: khong co ACTIVE -> dung ban DRAFT moi nhat")
    void resolveFallsBackToDraft() {
        when(surveys.findBySurveyCodeAndStatus(CODE, Survey.Status.ACTIVE)).thenReturn(Optional.empty());
        when(surveys.findFirstBySurveyCodeAndStatusOrderByVersionDesc(CODE, Survey.Status.DRAFT))
                .thenReturn(Optional.of(survey));

        assertThat(service.list(CODE, null, null, null).survey().surveyCode()).isEqualTo(CODE);
    }

    @Test
    @DisplayName("resolve: theo version -> dung ban DRAFT")
    void resolveByVersion() {
        when(surveys.findBySurveyCodeAndVersion(CODE, 1)).thenReturn(Optional.of(survey));

        assertThat(service.list(CODE, 1, null, null).survey().version()).isEqualTo(1);
    }

    @Test
    @DisplayName("lockEditable: survey bi xoa -> 404")
    void lockEditableMissingSurvey() {
        when(surveys.findByIdForUpdate(1L)).thenReturn(Optional.empty());

        assertError(() -> service.delete(CODE, null, 11L), HttpStatus.NOT_FOUND, "SURVEY_NOT_FOUND");
    }

    @Test
    @DisplayName("actor: user khong con -> 401")
    void actorMissing() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertError(() -> service.create(EMAIL, CODE, null, new CreateStepRequest("New", null, null, null)),
                HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
    }

    // ------------------------------------------------------------- preview

    @Test
    @DisplayName("preview: buoc RESULT -> khong co cau hoi, co result config")
    void previewOfResultStep() {
        var preview = service.preview(CODE, null, 13L);

        assertThat(preview.memberStepNumber()).isNull();
        assertThat(preview.memberStepCount()).isNull();
        assertThat(preview.questions()).isEmpty();
        assertThat(preview.resultConfig()).isNotNull();
    }

    @Test
    @DisplayName("preview: cau hoi khong co rule -> rules rong, va cau hoi co option")
    void previewFillsEmptyRulesAndOptions() {
        AssessmentQuestion age = question(101L, "AGE", "NUMBER");
        age.setValidationRules(null);
        link(body, age);
        AssessmentOption option = new AssessmentOption();
        option.setQuestion(age);
        option.setOptionCode("MALE");
        option.setOptionLabel("Male");
        option.setSortOrder(1);
        optionStore.add(option);

        var preview = service.preview(CODE, null, 11L);

        assertThat(preview.questions()).singleElement().satisfies(q -> {
            assertThat(q.validationRules().isEmpty()).isTrue();
            assertThat(q.options()).extracting(o -> o.optionCode()).containsExactly("MALE");
        });
    }

    @Test
    @DisplayName("preview: cau hoi co rule hong -> giu nguyen chuoi hong")
    void previewKeepsBrokenRules() {
        AssessmentQuestion age = question(101L, "AGE", "NUMBER");
        age.setValidationRules("{not json");
        link(body, age);

        var preview = service.preview(CODE, null, 11L);

        assertThat(preview.questions()).singleElement()
                .satisfies(q -> assertThat(q.validationRules().stringValue()).isEqualTo("{not json"));
    }

    @Test
    @DisplayName("preview check: buoc RESULT -> 400")
    void previewCheckOnResultStep() {
        assertError(() -> service.previewCheck(CODE, null, 13L, new PreviewCheckRequest(List.of())),
                HttpStatus.BAD_REQUEST, "NOT_A_QUESTION_STEP");
    }

    @Test
    @DisplayName("preview check: truong la -> 400")
    void previewCheckRejectsUnknownField() {
        when(loader.loadUnvalidated(any())).thenReturn(SurveyFixtures.onboarding());
        AnswerItem item = AnswerItem.of("AGE", SurveyFixtures.json("30"));
        item.addUnknownField("oops", 1);

        var response = service.previewCheck(CODE, null, 11L, new PreviewCheckRequest(List.of(item)));

        assertThat(response.errors()).extracting(ErrorItem::code).contains("UNKNOWN_FIELD");
    }

    @Test
    @DisplayName("preview check: cau hoi bi tra loi -> 400")
    void previewCheckRejectsDuplicateQuestion() {
        when(loader.loadUnvalidated(any())).thenReturn(SurveyFixtures.onboarding());

        var response = service.previewCheck(CODE, null, 11L, new PreviewCheckRequest(List.of(
                AnswerItem.of("AGE", SurveyFixtures.json("30")),
                AnswerItem.of("AGE", SurveyFixtures.json("31")))));

        assertThat(response.errors()).extracting(ErrorItem::code).contains("DUPLICATE_QUESTION");
    }

    @Test
    @DisplayName("preview check: thieu value -> 400")
    void previewCheckRejectsMissingValue() {
        when(loader.loadUnvalidated(any())).thenReturn(SurveyFixtures.onboarding());
        AnswerItem item = new AnswerItem();
        item.setQuestionCode("AGE");

        var response = service.previewCheck(CODE, null, 11L, new PreviewCheckRequest(List.of(item)));

        assertThat(response.errors()).extracting(ErrorItem::code).contains("VALUE_MISSING");
    }

    @Test
    @DisplayName("preview check: loai cau hoi khong ho tro -> 400")
    void previewCheckRejectsUnsupportedType() {
        when(loader.loadUnvalidated(any())).thenReturn(SurveyFixtures.survey(
                SurveyFixtures.step("BODY_INFORMATION",
                        SurveyFixtures.link(SurveyFixtures.question("MYSTERY", "MYSTERY", false, null), null))));

        var response = service.previewCheck(CODE, null, 11L, new PreviewCheckRequest(List.of(
                AnswerItem.of("MYSTERY", SurveyFixtures.json("\"x\"")))));

        assertThat(response.errors()).extracting(ErrorItem::code).containsExactly("UNSUPPORTED_QUESTION_TYPE");
    }

    // -------------------------------------------------- available questions

    @Test
    @DisplayName("available questions: search qua gioi han -> 400")
    void availableQuestionsRejectsLongSearch() {
        assertError(() -> service.availableQuestions(CODE, null, null, "x".repeat(101)),
                HttpStatus.BAD_REQUEST, "INVALID_REQUEST");
    }

    @Test
    @DisplayName("available questions: buoc RESULT -> 400")
    void availableQuestionsOnResultStep() {
        assertError(() -> service.availableQuestions(CODE, null, 13L, null),
                HttpStatus.BAD_REQUEST, "RESULT_STEP_NOT_EDITABLE");
    }

    @Test
    @DisplayName("available questions: lien ket da an -> bo qua")
    void availableQuestionsSkipsInactiveLinks() {
        AssessmentQuestion age = question(101L, "AGE", "NUMBER");
        SurveyStepQuestion link = link(body, age);
        link.setActive(false);

        assertThat(service.availableQuestions(CODE, null, null, null))
                .extracting(q -> q.questionCode()).containsExactly("AGE");
    }

    // -------------------------------------------------------- result config

    @Test
    @DisplayName("result config: doc cau hinh va danh sach level")
    void getResultConfigReturnsLevels() {
        FitnessLevel level = new FitnessLevel();
        level.setId(1L);
        level.setName("Beginner");
        when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of(level));

        ResultConfigResponse response = service.getResultConfig(CODE, null, 13L);

        assertThat(response.config()).isNotNull();
        assertThat(response.fitnessLevels()).extracting(l -> l.name()).containsExactly("Beginner");
    }

    @Test
    @DisplayName("result config: cau hinh hong -> tra ve mac dinh")
    void resultConfigFallsBackToDefaults() {
        result.setResultConfig("{not json");

        assertThat(service.getResultConfig(CODE, null, 13L).config())
                .isEqualTo(ResultConfig.defaults());
    }

    @Test
    @DisplayName("result config: rong -> tra ve mac dinh")
    void resultConfigNullFallsBackToDefaults() {
        result.setResultConfig(null);

        assertThat(service.getResultConfig(CODE, null, 13L).config())
                .isEqualTo(ResultConfig.defaults());
    }

    @Test
    @DisplayName("result config: luu cau hinh moi")
    void updateResultConfigSaves() {
        ResultConfig config = new ResultConfig(true, false, 6, 4, 45, null);

        ResultConfigResponse response = service.updateResultConfig(EMAIL, CODE, null, 13L,
                new UpdateResultConfigRequest("  Result and plan  ", "  desc  ", config));

        assertThat(response.config()).isEqualTo(config);
        assertThat(result.getStepName()).isEqualTo("Result and plan");
        assertThat(result.getDescription()).isEqualTo("desc");
        assertThat(result.getRevision()).isEqualTo(1);
    }

    // --------------------------------------------------------------- create

    @Test
    @DisplayName("create: buoc RESULT khi chua co -> tao duoc va co result config mac dinh")
    void createResultStep() {
        stepStore.removeIf(s -> s.getId().equals(13L));

        var created = service.create(EMAIL, CODE, null,
                new CreateStepRequest("Outcome", null, null, SurveyStep.Type.RESULT));

        assertThat(created.step().stepType()).isEqualTo("RESULT");
        assertThat(created.resultConfig()).isEqualTo(ResultConfig.defaults());
    }

    @Test
    @DisplayName("create: buoc RESULT co cau hoi -> 400")
    void createResultStepWithQuestionsIsRejected() {
        stepStore.removeIf(s -> s.getId().equals(13L));

        assertError(() -> service.create(EMAIL, CODE, null, new CreateStepRequest("Outcome", null, null,
                        SurveyStep.Type.RESULT,
                        List.of(new StepQuestionInput(null, false,
                                new QuestionContentInput("Text", null, "TEXT", null, null, null))))),
                HttpStatus.BAD_REQUEST, "RESULT_STEP_NOT_EDITABLE");
    }

    // --------------------------------------------------------------- update

    @Test
    @DisplayName("update: cau hoi INACTIVE -> 400")
    void updateRejectsInactiveQuestion() {
        AssessmentQuestion hidden = question(101L, "HIDDEN", "NUMBER");
        hidden.setStatus(ConfigStatus.INACTIVE);

        assertThatThrownBy(() -> service.update(EMAIL, CODE, null, 11L, new UpdateStepRequest(0,
                        "Body information", null, SurveyStep.Status.ACTIVE,
                        List.of(new StepQuestionInput("HIDDEN", true)))))
                .isInstanceOfSatisfying(SurveyException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("INVALID_STEP_QUESTIONS");
                    assertThat(e.getErrors()).extracting(ErrorItem::code).containsExactly("QUESTION_INACTIVE");
                });
    }

    @Test
    @DisplayName("update: cau hoi moi trong buoc -> duoc tao va ghi vao ngan hang")
    void updateCreatesNewQuestion() {
        var response = service.update(EMAIL, CODE, null, 11L, new UpdateStepRequest(0,
                "Body information", null, SurveyStep.Status.ACTIVE,
                List.of(new StepQuestionInput(null, true,
                        new QuestionContentInput("How tall are you", null, "NUMBER", "cm", null, null)))));

        assertThat(response.questions()).extracting(q -> q.questionCode()).containsExactly("HOW_TALL_ARE_YOU");
    }

    // --------------------------------------------------------- change status

    @Test
    @DisplayName("change status: trang thai giong nhau -> tra ve luon")
    void changeStatusToSameStatus() {
        var response = service.changeStatus(EMAIL, CODE, null, 11L,
                new ChangeStepStatusRequest(SurveyStep.Status.ACTIVE));

        assertThat(response.step().status()).isEqualTo("ACTIVE");
    }

    // -------------------------------------------------------------- summary

    @Test
    @DisplayName("summary: updatedAt lay theo cau hoi moi nhat")
    void summaryUsesLatestQuestionTimestamp() {
        AssessmentQuestion age = question(101L, "AGE", "NUMBER");
        age.setUpdatedAt(LocalDateTime.of(2026, 5, 5, 0, 0));
        link(body, age);

        var list = service.list(CODE, null, null, null);

        assertThat(list.steps().get(0).updatedAt()).isEqualTo(LocalDateTime.of(2026, 5, 5, 0, 0));
    }

    @Test
    @DisplayName("summary: cau hoi khong co updatedAt -> dung moc thoi gian cua buoc")
    void summaryFallsBackToStepTimestamp() {
        AssessmentQuestion age = question(101L, "AGE", "NUMBER");
        age.setUpdatedAt(null);
        link(body, age);

        var list = service.list(CODE, null, null, null);

        assertThat(list.steps().get(0).updatedAt()).isEqualTo(LocalDateTime.of(2026, 1, 1, 0, 0));
    }

    // ------------------------------------------------------- preview errors

    @Test
    @DisplayName("preview check: cau hoi bi an boi dieu kien -> QUESTION_NOT_APPLICABLE")
    void previewCheckReportsNotApplicable() {
        when(loader.loadUnvalidated(any())).thenReturn(SurveyFixtures.onboarding());
        body.setStepCode("GOALS_AND_MOTIVATION");

        var response = service.previewCheck(CODE, null, 11L, new PreviewCheckRequest(List.of(
                AnswerItem.of("GOAL_TYPE", SurveyFixtures.json("\"HEALTH\"")),
                AnswerItem.of("HEALTH_GOAL", SurveyFixtures.json("\"STAY_FIT\"")),
                AnswerItem.of("TRAINING_SKILLS", SurveyFixtures.json("[\"PLANCHE\"]")))));

        assertThat(response.errors()).extracting(ErrorItem::questionCode, ErrorItem::code)
                .contains(tuple("TRAINING_SKILLS", "QUESTION_NOT_APPLICABLE"));
    }
}
