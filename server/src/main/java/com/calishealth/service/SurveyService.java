package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.OptionResponse;
import com.calishealth.dtos.SurveyDtos.QuestionResponse;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.dtos.SurveyDtos.ResultStepResponse;
import com.calishealth.dtos.SurveyDtos.StepResponse;
import com.calishealth.dtos.SurveyDtos.SurveyDefinitionResponse;
import com.calishealth.exception.SurveyException;
import com.calishealth.models.Survey;
import com.calishealth.models.SurveyStep;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.repository.SurveyStepRepository;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SurveyService {
    private final SurveyRepository surveys;
    private final SurveyStepRepository steps;
    private final SurveyDefinitionLoader loader;

    /**
     * Định nghĩa khảo sát cho frontend. version == null -> version đang ACTIVE;
     * có version -> cho phép đọc cả version ARCHIVED (để tiếp tục phiên cũ), không bao giờ trả DRAFT.
     */
    @Transactional(readOnly = true)
    public SurveyDefinitionResponse getDefinition(String surveyCode, Integer version) {
        Survey survey = version == null
                ? findActiveSurvey(surveyCode)
                : surveys.findBySurveyCodeAndVersion(surveyCode, version)
                        .filter(s -> s.getStatus() != Survey.Status.DRAFT)
                        .orElseThrow(() -> SurveyException.notFound("SURVEY_NOT_FOUND",
                                "Survey '" + surveyCode + "' version " + version + " does not exist"));
        return toResponse(loader.load(survey), activeResultStep(survey));
    }

    /**
     * Bước RESULT đang ACTIVE của survey (null nếu không có); cấu hình JSON hỏng được coi là lỗi cấu hình survey.
     * Dùng cả khi chấm level (level dự phòng, số tuần/buổi của kế hoạch gợi ý).
     */
    @Transactional(readOnly = true)
    public ResultStepResponse activeResultStep(Survey survey) {
        return steps.findBySurveyIdAndStepTypeAndStatus(survey.getId(), SurveyStep.Type.RESULT, SurveyStep.Status.ACTIVE)
                .map(step -> {
                    ResultConfig config;
                    try {
                        config = SurveyJson.read(step.getResultConfig(), ResultConfig.class);
                    } catch (IllegalArgumentException exception) {
                        log.error("Survey {} v{} step {} has an invalid result_config: {}", survey.getSurveyCode(),
                                survey.getVersion(), step.getStepCode(), exception.getMessage());
                        throw SurveyException.configInvalid();
                    }
                    return new ResultStepResponse(step.getStepCode(), step.getStepName(), step.getDescription(),
                            config == null ? ResultConfig.defaults() : config);
                })
                .orElse(null);
    }

    /** Version ACTIVE của 1 survey; tồn tại nhưng không có version ACTIVE -> SURVEY_INACTIVE. */
    @Transactional(readOnly = true)
    public Survey findActiveSurvey(String surveyCode) {
        return surveys.findBySurveyCodeAndStatus(surveyCode, Survey.Status.ACTIVE)
                .orElseThrow(() -> surveys.existsBySurveyCode(surveyCode)
                        ? SurveyException.conflict("SURVEY_INACTIVE", "Survey '" + surveyCode + "' is not active")
                        : SurveyException.notFound("SURVEY_NOT_FOUND", "Survey '" + surveyCode + "' does not exist"));
    }

    private static SurveyDefinitionResponse toResponse(SurveyDefinition definition, ResultStepResponse result) {
        return new SurveyDefinitionResponse(definition.code(), definition.name(), definition.description(),
                definition.version(),
                definition.activeSteps().stream().map(SurveyService::toStep).toList(),
                result);
    }

    private static StepResponse toStep(StepDefinition step) {
        return new StepResponse(step.code(), step.name(), step.description(), step.sortOrder(),
                step.questions().stream().filter(StepQuestion::active).map(SurveyService::toQuestion).toList());
    }

    private static QuestionResponse toQuestion(StepQuestion stepQuestion) {
        QuestionDefinition q = stepQuestion.question();
        return new QuestionResponse(q.code(), q.text(), q.description(), q.type(), q.required(),
                q.validationRules(), q.displayConfig(), q.unit(), q.defaultValue(), stepQuestion.sortOrder(),
                stepQuestion.conditionJson(),
                q.activeOptions().stream()
                        .map(o -> new OptionResponse(o.code(), o.label(), o.value(), o.sortOrder()))
                        .toList());
    }
}
