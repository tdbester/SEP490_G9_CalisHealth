package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.dtos.SurveyDtos.SurveyDefinitionResponse;
import com.calishealth.exception.SurveyException;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.repository.SurveyStepRepository;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import com.calishealth.service.survey.definition.OptionDefinition;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link SurveyService}: nạp định nghĩa khảo sát, đọc bước RESULT và
 * mapping sang DTO cho frontend.
 */
class SurveyServiceTest {

    private SurveyRepository surveys;
    private SurveyStepRepository steps;
    private SurveyDefinitionLoader loader;
    private SurveyService service;

    @BeforeEach
    void setUp() {
        surveys = mock(SurveyRepository.class);
        steps = mock(SurveyStepRepository.class);
        loader = mock(SurveyDefinitionLoader.class);
        service = new SurveyService(surveys, steps, loader);
    }

    private Survey survey(String code, Survey.Status status, int version) {
        Survey survey = new Survey();
        survey.setId(1L);
        survey.setSurveyCode(code);
        survey.setSurveyName("Survey " + code);
        survey.setDescription("desc");
        survey.setVersion(version);
        survey.setStatus(status);
        return survey;
    }

    private SurveyStep resultStep(String resultConfig) {
        SurveyStep step = new SurveyStep();
        step.setId(99L);
        step.setStepCode("RESULT");
        step.setStepName("Result");
        step.setDescription("result desc");
        step.setStepType(SurveyStep.Type.RESULT);
        step.setStatus(SurveyStep.Status.ACTIVE);
        step.setResultConfig(resultConfig);
        return step;
    }

    private SurveyDefinition definition() {
        QuestionDefinition question = new QuestionDefinition(
                10L, "Q1", "Text?", "hint", "TEXT", true,
                null, null, "kg", null, true,
                List.of(new OptionDefinition("A", "Label A", "a", 1, true),
                        new OptionDefinition("B", "Label B", "b", 2, false)));
        StepQuestion activeQuestion = new StepQuestion(question, 1, true, null, null);
        QuestionDefinition inactive = new QuestionDefinition(
                11L, "Q2", "Hidden?", null, "TEXT", false,
                null, null, null, null, false, List.of());
        StepQuestion inactiveQuestion = new StepQuestion(inactive, 2, false, null, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", "step desc", 1, true,
                List.of(activeQuestion, inactiveQuestion));
        StepDefinition inactiveStep = new StepDefinition("S2", "Step 2", null, 2, false, List.of());
        return new SurveyDefinition(1L, "SURVEY", "Survey SURVEY", "desc", 3,
                List.of(step, inactiveStep));
    }

    @Test
    @DisplayName("getDefinition: version null -> dung version ACTIVE")
    void getDefinitionUsesActiveSurvey() {
        Survey active = survey("SURVEY", Survey.Status.ACTIVE, 3);
        when(surveys.findBySurveyCodeAndStatus("SURVEY", Survey.Status.ACTIVE)).thenReturn(Optional.of(active));
        when(loader.load(active)).thenReturn(definition());
        when(steps.findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE))
                .thenReturn(Optional.empty());

        SurveyDefinitionResponse response = service.getDefinition("SURVEY", null);

        assertThat(response.surveyCode()).isEqualTo("SURVEY");
        assertThat(response.version()).isEqualTo(3);
        assertThat(response.steps()).hasSize(1);
        assertThat(response.steps().get(0).questions()).hasSize(1);
        assertThat(response.steps().get(0).questions().get(0).options()).hasSize(1);
        assertThat(response.result()).isNull();
    }

    @Test
    @DisplayName("getDefinition: version chi dinh -> dung version archive")
    void getDefinitionUsesRequestedVersion() {
        Survey archived = survey("SURVEY", Survey.Status.ARCHIVED, 2);
        when(surveys.findBySurveyCodeAndVersion("SURVEY", 2)).thenReturn(Optional.of(archived));
        when(loader.load(archived)).thenReturn(definition());
        when(steps.findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE))
                .thenReturn(Optional.of(resultStep(null)));

        SurveyDefinitionResponse response = service.getDefinition("SURVEY", 2);

        assertThat(response.version()).isEqualTo(3);
        assertThat(response.result()).isNotNull();
        assertThat(response.result().config().planDurationWeeks()).isEqualTo(4);
    }

    @Test
    @DisplayName("getDefinition: version DRAFT -> 404")
    void getDefinitionRejectsDraftVersion() {
        Survey draft = survey("SURVEY", Survey.Status.DRAFT, 1);
        when(surveys.findBySurveyCodeAndVersion("SURVEY", 1)).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.getDefinition("SURVEY", 1))
                .isInstanceOf(SurveyException.class)
                .hasMessageContaining("does not exist");
    }

    @Test
    @DisplayName("getDefinition: version khong ton tai -> 404")
    void getDefinitionRejectsMissingVersion() {
        when(surveys.findBySurveyCodeAndVersion("SURVEY", 9)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDefinition("SURVEY", 9))
                .isInstanceOf(SurveyException.class)
                .hasMessageContaining("SURVEY");
    }

    @Test
    @DisplayName("findActiveSurvey: khong co survey -> 404")
    void findActiveSurveyThrowsNotFound() {
        when(surveys.findBySurveyCodeAndStatus("X", Survey.Status.ACTIVE)).thenReturn(Optional.empty());
        when(surveys.existsBySurveyCode("X")).thenReturn(false);

        assertThatThrownBy(() -> service.findActiveSurvey("X"))
                .isInstanceOf(SurveyException.class)
                .extracting(exception -> ((SurveyException) exception).getStatus())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("findActiveSurvey: co survey nhung khong active -> 409")
    void findActiveSurveyThrowsConflict() {
        when(surveys.findBySurveyCodeAndStatus("X", Survey.Status.ACTIVE)).thenReturn(Optional.empty());
        when(surveys.existsBySurveyCode("X")).thenReturn(true);

        assertThatThrownBy(() -> service.findActiveSurvey("X"))
                .isInstanceOf(SurveyException.class)
                .extracting(exception -> ((SurveyException) exception).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("activeResultStep: khong co buoc RESULT -> null")
    void activeResultStepReturnsNullWhenMissing() {
        when(steps.findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE))
                .thenReturn(Optional.empty());

        assertThat(service.activeResultStep(survey("SURVEY", Survey.Status.ACTIVE, 1))).isNull();
    }

    @Test
    @DisplayName("activeResultStep: result_config hop le -> tra cau hinh")
    void activeResultStepReadsConfig() {
        String json = "{\"showLevelBreakdown\":false,\"showPlanPreview\":true,\"planDurationWeeks\":6,"
                + "\"sessionsPerWeek\":4,\"minutesPerSession\":45,\"fallbackFitnessLevelId\":7}";
        when(steps.findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE))
                .thenReturn(Optional.of(resultStep(json)));

        var result = service.activeResultStep(survey("SURVEY", Survey.Status.ACTIVE, 1));

        assertThat(result).isNotNull();
        assertThat(result.stepCode()).isEqualTo("RESULT");
        assertThat(result.config().showLevelBreakdown()).isFalse();
        assertThat(result.config().planDurationWeeks()).isEqualTo(6);
        assertThat(result.config().fallbackFitnessLevelId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("activeResultStep: result_config hong -> 500 config invalid")
    void activeResultStepRejectsInvalidConfig() {
        when(steps.findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE))
                .thenReturn(Optional.of(resultStep("{invalid json")));

        assertThatThrownBy(() -> service.activeResultStep(survey("SURVEY", Survey.Status.ACTIVE, 1)))
                .isInstanceOf(SurveyException.class)
                .extracting(exception -> ((SurveyException) exception).getCode())
                .isEqualTo("SURVEY_CONFIG_INVALID");
    }

    @Test
    @DisplayName("activeResultStep: config rong -> dung gia tri mac dinh")
    void activeResultStepUsesDefaultsWhenConfigMissing() {
        when(steps.findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE))
                .thenReturn(Optional.of(resultStep(null)));

        var result = service.activeResultStep(survey("SURVEY", Survey.Status.ACTIVE, 1));

        assertThat(result.config()).isEqualTo(ResultConfig.defaults());
    }

    @Test
    @DisplayName("toResponse: bo qua step khong active va cau hoi khong active")
    void toResponseSkipsInactiveContent() {
        Survey active = survey("SURVEY", Survey.Status.ACTIVE, 1);
        when(surveys.findBySurveyCodeAndStatus(anyString(), any(Survey.Status.class))).thenReturn(Optional.of(active));
        when(loader.load(any())).thenReturn(definition());
        when(steps.findBySurveyIdAndStepTypeAndStatus(any(), any(), any())).thenReturn(Optional.empty());

        SurveyDefinitionResponse response = service.getDefinition("SURVEY", null);

        assertThat(response.steps()).hasSize(1);
        assertThat(response.steps().get(0).stepCode()).isEqualTo("S1");
        assertThat(response.steps().get(0).questions()).hasSize(1);
        assertThat(response.steps().get(0).questions().get(0).questionCode()).isEqualTo("Q1");
        assertThat(response.steps().get(0).questions().get(0).options()).hasSize(1);
        assertThat(response.steps().get(0).questions().get(0).options().get(0).label()).isEqualTo("Label A");
    }

    @Test
    @DisplayName("getDefinition: repository goi dung bien")
    void getDefinitionUsesRepositoryLookups() {
        Survey active = survey("SURVEY", Survey.Status.ACTIVE, 1);
        when(surveys.findBySurveyCodeAndStatus("SURVEY", Survey.Status.ACTIVE)).thenReturn(Optional.of(active));
        when(loader.load(active)).thenReturn(definition());
        when(steps.findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE))
                .thenReturn(Optional.empty());

        service.getDefinition("SURVEY", null);

        org.mockito.Mockito.verify(surveys).findBySurveyCodeAndStatus("SURVEY", Survey.Status.ACTIVE);
        org.mockito.Mockito.verify(steps)
                .findBySurveyIdAndStepTypeAndStatus(1L, SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE);
    }

    @Test
    @DisplayName("getDefinition: version duoc truyen -> goi findBySurveyCodeAndVersion")
    void getDefinitionLooksUpVersion() {
        Survey archived = survey("SURVEY", Survey.Status.ARCHIVED, 5);
        when(surveys.findBySurveyCodeAndVersion("SURVEY", 5)).thenReturn(Optional.of(archived));
        when(loader.load(archived)).thenReturn(definition());
        when(steps.findBySurveyIdAndStepTypeAndStatus(any(), any(), any())).thenReturn(Optional.empty());

        service.getDefinition("SURVEY", 5);

        org.mockito.Mockito.verify(surveys).findBySurveyCodeAndVersion("SURVEY", 5);
        org.mockito.Mockito.verify(surveys, org.mockito.Mockito.never())
                .findBySurveyCodeAndStatus(anyString(), any(Survey.Status.class));
    }

    @Test
    @DisplayName("findActiveSurvey: tra ve survey khi co version active")
    void findActiveSurveyReturnsSurvey() {
        Survey active = survey("SURVEY", Survey.Status.ACTIVE, 1);
        when(surveys.findBySurveyCodeAndStatus("SURVEY", Survey.Status.ACTIVE)).thenReturn(Optional.of(active));

        assertThat(service.findActiveSurvey("SURVEY")).isSameAs(active);
    }

    @Test
    @DisplayName("getDefinition: definition rong step -> danh sach step rong")
    void getDefinitionHandlesEmptyDefinition() {
        Survey active = survey("SURVEY", Survey.Status.ACTIVE, 1);
        when(surveys.findBySurveyCodeAndStatus("SURVEY", Survey.Status.ACTIVE)).thenReturn(Optional.of(active));
        when(loader.load(active)).thenReturn(new SurveyDefinition(1L, "SURVEY", "n", null, 1, List.of()));
        when(steps.findBySurveyIdAndStepTypeAndStatus(any(), any(), any())).thenReturn(Optional.empty());

        SurveyDefinitionResponse response = service.getDefinition("SURVEY", null);

        assertThat(response.steps()).isEmpty();
        assertThat(response.description()).isNull();
    }

    @Test
    @DisplayName("getDefinition: version null -> goi findActiveSurvey va truyền survey dung loader")
    void getDefinitionDelegatesToActiveSurvey() {
        Survey active = survey("SURVEY", Survey.Status.ACTIVE, 7);
        when(surveys.findBySurveyCodeAndStatus("SURVEY", Survey.Status.ACTIVE)).thenReturn(Optional.of(active));
        when(loader.load(any())).thenReturn(definition());
        when(steps.findBySurveyIdAndStepTypeAndStatus(any(), any(), any())).thenReturn(Optional.empty());

        service.getDefinition("SURVEY", null);

        org.mockito.Mockito.verify(loader).load(active);
        org.mockito.Mockito.verify(steps)
                .findBySurveyIdAndStepTypeAndStatus(active.getId(), SurveyStep.Type.RESULT,
                        SurveyStep.Status.ACTIVE);
    }

    @Test
    @DisplayName("activeResultStep: khong co result step -> khong goi them")
    void activeResultStepSkipsLoaderWhenNoStep() {
        when(steps.findBySurveyIdAndStepTypeAndStatus(any(), any(), any())).thenReturn(Optional.empty());

        assertThat(service.activeResultStep(survey("SURVEY", Survey.Status.ACTIVE, 1))).isNull();
        org.mockito.Mockito.verifyNoInteractions(loader);
    }

    @Test
    @DisplayName("getDefinition: survey khong ton tai -> 404")
    void getDefinitionThrowsWhenSurveyMissing() {
        when(surveys.findBySurveyCodeAndStatus("NOPE", Survey.Status.ACTIVE)).thenReturn(Optional.empty());
        when(surveys.existsBySurveyCode("NOPE")).thenReturn(false);

        assertThatThrownBy(() -> service.getDefinition("NOPE", null))
                .isInstanceOf(SurveyException.class);
    }

    @Test
    @DisplayName("getDefinition: version khac null -> khong dung path ACTIVE")
    void getDefinitionWithVersionDoesNotUseActivePath() {
        when(surveys.findBySurveyCodeAndVersion("SURVEY", 3)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDefinition("SURVEY", 3)).isInstanceOf(SurveyException.class);
        org.mockito.Mockito.verify(surveys).findBySurveyCodeAndVersion("SURVEY", 3);
    }
}
