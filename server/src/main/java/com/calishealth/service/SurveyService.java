package com.calishealth.service;

import com.calishealth.dtos.SurveyDtos.OptionResponse;
import com.calishealth.dtos.SurveyDtos.QuestionResponse;
import com.calishealth.dtos.SurveyDtos.StepResponse;
import com.calishealth.dtos.SurveyDtos.SurveyDefinitionResponse;
import com.calishealth.exception.SurveyException;
import com.calishealth.models.Survey;
import com.calishealth.repository.SurveyRepository;
import com.calishealth.service.survey.SurveyDefinitionLoader;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SurveyService {
    private final SurveyRepository surveys;
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
        return toResponse(loader.load(survey));
    }

    /** Version ACTIVE của 1 survey; tồn tại nhưng không có version ACTIVE -> SURVEY_INACTIVE. */
    @Transactional(readOnly = true)
    public Survey findActiveSurvey(String surveyCode) {
        return surveys.findBySurveyCodeAndStatus(surveyCode, Survey.Status.ACTIVE)
                .orElseThrow(() -> surveys.existsBySurveyCode(surveyCode)
                        ? SurveyException.conflict("SURVEY_INACTIVE", "Survey '" + surveyCode + "' is not active")
                        : SurveyException.notFound("SURVEY_NOT_FOUND", "Survey '" + surveyCode + "' does not exist"));
    }

    private static SurveyDefinitionResponse toResponse(SurveyDefinition definition) {
        return new SurveyDefinitionResponse(definition.code(), definition.name(), definition.description(),
                definition.version(),
                definition.activeSteps().stream().map(SurveyService::toStep).toList());
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
