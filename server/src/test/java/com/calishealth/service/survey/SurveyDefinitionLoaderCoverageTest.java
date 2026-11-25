package com.calishealth.service.survey;

import com.calishealth.exception.SurveyException;
import com.calishealth.models.AssessmentOption;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.models.SurveyStepQuestion;
import com.calishealth.repository.AssessmentOptionRepository;
import com.calishealth.repository.SurveyStepQuestionRepository;
import com.calishealth.repository.SurveyStepRepository;
import com.calishealth.service.survey.definition.SurveyDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link SurveyDefinitionLoader}: build định nghĩa survey từ DB và các nhánh báo lỗi cấu hình.
 */
@ExtendWith(MockitoExtension.class)
class SurveyDefinitionLoaderCoverageTest {

    @Mock private SurveyStepRepository steps;
    @Mock private SurveyStepQuestionRepository stepQuestions;
    @Mock private AssessmentOptionRepository options;
    @Mock private SurveyConfigValidator validator;
    @InjectMocks private SurveyDefinitionLoader loader;

    private static Survey survey() {
        Survey survey = new Survey();
        survey.setId(1L);
        survey.setSurveyCode("ONBOARDING");
        survey.setSurveyName("Onboarding");
        survey.setVersion(1);
        return survey;
    }

    private static SurveyStep step(Long id, String code, SurveyStep.Type type, SurveyStep.Status status, int sortOrder) {
        SurveyStep step = new SurveyStep();
        step.setId(id);
        step.setStepCode(code);
        step.setStepName(code);
        step.setStepType(type);
        step.setStatus(status);
        step.setSortOrder(sortOrder);
        return step;
    }

    private static AssessmentQuestion question(Long id, String code, String type) {
        AssessmentQuestion question = new AssessmentQuestion();
        question.setId(id);
        question.setQuestionCode(code);
        question.setQuestionText(code);
        question.setQuestionType(type);
        question.setStatus(ConfigStatus.ACTIVE);
        return question;
    }

    private static SurveyStepQuestion link(SurveyStep step, AssessmentQuestion question, int sortOrder) {
        SurveyStepQuestion link = new SurveyStepQuestion();
        link.setStep(step);
        link.setQuestion(question);
        link.setSortOrder(sortOrder);
        link.setRequired(true);
        return link;
    }

    private void stubEmpty() {
        lenient().when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of());
        lenient().when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of());
        lenient().when(validator.validate(any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("Load: cau hinh hop le -> tra ve dinh nghia")
    void loadReturnsDefinitionForValidConfig() {
        AssessmentQuestion goal = question(10L, "GOAL_TYPE", "SINGLE_CHOICE");
        SurveyStep stepOne = step(100L, "STEP_1", SurveyStep.Type.QUESTIONS, SurveyStep.Status.ACTIVE, 1);

        AssessmentOption option = new AssessmentOption();
        option.setQuestion(goal);
        option.setOptionCode("A");
        option.setOptionLabel("A");
        option.setOptionValue("A");
        option.setSortOrder(1);
        option.setStatus(ConfigStatus.ACTIVE);

        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of(link(stepOne, goal, 1)));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of(option));
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(stepOne));
        when(validator.validate(any())).thenReturn(List.of());

        SurveyDefinition definition = loader.load(survey());

        assertThat(definition.steps()).hasSize(1);
        assertThat(definition.steps().get(0).questions()).hasSize(1);
        assertThat(definition.steps().get(0).questions().get(0).question().options()).hasSize(1);
    }

    @Test
    @DisplayName("Load: buoc RESULT -> bo qua khoi dinh nghia")
    void loadSkipsResultSteps() {
        SurveyStep resultStep = step(200L, "RESULT", SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE, 2);
        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of());
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(resultStep));
        when(validator.validate(any())).thenReturn(List.of());

        SurveyDefinition definition = loader.load(survey());

        assertThat(definition.steps()).isEmpty();
    }

    @Test
    @DisplayName("Load: buoc RESULT co cau hoi -> bao loi cau hinh")
    void loadReportsResultStepWithQuestions() {
        AssessmentQuestion goal = question(10L, "GOAL_TYPE", "SINGLE_CHOICE");
        SurveyStep resultStep = step(200L, "RESULT", SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE, 2);

        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of(link(resultStep, goal, 1)));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(resultStep));

        assertThatThrownBy(() -> loader.load(survey()))
                .isInstanceOf(SurveyException.class)
                .hasMessageContaining("config");
    }

    @Test
    @DisplayName("Load: JSON khong hop le -> bao loi cau hinh")
    void loadReportsInvalidJson() {
        AssessmentQuestion goal = question(10L, "GOAL_TYPE", "SINGLE_CHOICE");
        goal.setValidationRules("{not json");
        SurveyStep stepOne = step(100L, "STEP_1", SurveyStep.Type.QUESTIONS, SurveyStep.Status.ACTIVE, 1);

        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of(link(stepOne, goal, 1)));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(stepOne));

        assertThatThrownBy(() -> loader.load(survey())).isInstanceOf(SurveyException.class);
    }

    @Test
    @DisplayName("Load: conditional_rules sai -> bao loi cau hinh")
    void loadReportsInvalidConditionalRules() {
        AssessmentQuestion goal = question(10L, "GOAL_TYPE", "SINGLE_CHOICE");
        SurveyStep stepOne = step(100L, "STEP_1", SurveyStep.Type.QUESTIONS, SurveyStep.Status.ACTIVE, 1);
        SurveyStepQuestion link = link(stepOne, goal, 1);
        link.setConditionalRules("{\"operator\":\"NOPE\"}");

        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of(link));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(stepOne));

        assertThatThrownBy(() -> loader.load(survey())).isInstanceOf(SurveyException.class);
    }

    @Test
    @DisplayName("Find problems: khong nem loi, tra ve danh sach loi")
    void findProblemsReturnsListWithoutThrowing() {
        AssessmentQuestion goal = question(10L, "GOAL_TYPE", "SINGLE_CHOICE");
        goal.setDisplayConfig("{oops");
        SurveyStep stepOne = step(100L, "STEP_1", SurveyStep.Type.QUESTIONS, SurveyStep.Status.ACTIVE, 1);

        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of(link(stepOne, goal, 1)));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(stepOne));

        assertThat(loader.findProblems(survey())).isNotEmpty();
    }

    @Test
    @DisplayName("Find problems: cau hinh hop le -> danh sach rong")
    void findProblemsReturnsEmptyForValidConfig() {
        stubEmpty();

        assertThat(loader.findProblems(survey())).isEmpty();
    }

    @Test
    @DisplayName("Load unvalidated: cau hinh sai van tra ve dinh nghia")
    void loadUnvalidatedSkipsValidation() {
        AssessmentQuestion goal = question(10L, "GOAL_TYPE", "SINGLE_CHOICE");
        goal.setValidationRules("{broken");
        SurveyStep stepOne = step(100L, "STEP_1", SurveyStep.Type.QUESTIONS, SurveyStep.Status.ACTIVE, 1);

        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of(link(stepOne, goal, 1)));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(stepOne));

        SurveyDefinition definition = loader.loadUnvalidated(survey());

        assertThat(definition.steps()).hasSize(1);
    }

    @Test
    @DisplayName("Load: validator bao loi -> nem loi cau hinh")
    void loadReportsValidatorProblems() {
        stubEmpty();
        when(validator.validate(any())).thenReturn(List.of("Step STEP_1 has no questions"));

        assertThatThrownBy(() -> loader.load(survey())).isInstanceOf(SurveyException.class);
    }

    @Test
    @DisplayName("Load: cau hoi khong ACTIVE -> khong bat buoc")
    void loadHandlesInactiveQuestion() {
        AssessmentQuestion goal = question(10L, "GOAL_TYPE", "SINGLE_CHOICE");
        goal.setStatus(ConfigStatus.INACTIVE);
        SurveyStep stepOne = step(100L, "STEP_1", SurveyStep.Type.QUESTIONS, SurveyStep.Status.DRAFT, 1);

        when(stepQuestions.findAllBySurveyId(1L)).thenReturn(List.of(link(stepOne, goal, 1)));
        when(options.findByQuestionIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
        when(steps.findBySurveyIdOrderBySortOrderAsc(1L)).thenReturn(List.of(stepOne));
        when(validator.validate(any())).thenReturn(List.of());

        SurveyDefinition definition = loader.load(survey());

        assertThat(definition.steps().get(0).questions()).hasSize(1);
    }
}
