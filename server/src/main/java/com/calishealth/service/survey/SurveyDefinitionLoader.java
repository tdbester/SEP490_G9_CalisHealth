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
import com.calishealth.service.survey.condition.Condition;
import com.calishealth.service.survey.condition.ConditionParser;
import com.calishealth.service.survey.definition.OptionDefinition;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Đọc cấu hình 1 survey version từ DB (3 query, không N+1) thành SurveyDefinition bất biến
 * và kiểm tra nó. Cấu hình sai -> log chi tiết + SURVEY_CONFIG_INVALID, không phục vụ dữ liệu lỗi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SurveyDefinitionLoader {
    private final SurveyStepRepository steps;
    private final SurveyStepQuestionRepository stepQuestions;
    private final AssessmentOptionRepository options;
    private final SurveyConfigValidator validator;

    public SurveyDefinition load(Survey survey) {
        List<String> problems = new ArrayList<>();
        SurveyDefinition definition = build(survey, problems);
        if (!problems.isEmpty()) {
            log.error("Survey {} v{} has an invalid configuration:\n - {}", survey.getSurveyCode(),
                    survey.getVersion(), String.join("\n - ", problems));
            throw SurveyException.configInvalid();
        }
        return definition;
    }

    /**
     * Lỗi cấu hình hiện tại của survey (rỗng = hợp lệ), không log và không ném lỗi.
     * Dùng để kiểm tra 1 thay đổi của content manager trước khi commit.
     */
    public List<String> findProblems(Survey survey) {
        List<String> problems = new ArrayList<>();
        build(survey, problems);
        return problems;
    }

    /**
     * Cấu hình survey KHÔNG kiểm tra lỗi: dùng cho Preview của content manager, nơi cần xem/thử cả bước
     * DRAFT hoặc survey đang có lỗi ở chỗ khác. Không bao giờ dùng cho luồng trả lời của member.
     */
    public SurveyDefinition loadUnvalidated(Survey survey) {
        return build(survey, new ArrayList<>());
    }

    private SurveyDefinition build(Survey survey, List<String> problems) {
        List<SurveyStepQuestion> links = stepQuestions.findAllBySurveyId(survey.getId());

        Map<Long, List<OptionDefinition>> optionsByQuestion = links.isEmpty() ? Map.of()
                : options.findByQuestionIdInOrderBySortOrderAsc(
                        links.stream().map(l -> l.getQuestion().getId()).distinct().toList())
                .stream()
                .collect(Collectors.groupingBy(o -> o.getQuestion().getId(), LinkedHashMap::new,
                        Collectors.mapping(SurveyDefinitionLoader::toOption, Collectors.toList())));

        Map<Long, List<StepQuestion>> questionsByStep = new HashMap<>();
        for (SurveyStepQuestion link : links) {
            AssessmentQuestion q = link.getQuestion();
            String where = "Question " + q.getQuestionCode();
            QuestionDefinition question = new QuestionDefinition(
                    q.getId(), q.getQuestionCode(), q.getQuestionText(), q.getDescription(), q.getQuestionType(),
                    link.isEffectivelyRequired(),
                    json(q.getValidationRules(), where + " validation_rules", problems),
                    json(q.getDisplayConfig(), where + " display_config", problems),
                    q.getUnit(),
                    json(q.getDefaultValue(), where + " default_value", problems),
                    q.getStatus() == ConfigStatus.ACTIVE,
                    optionsByQuestion.getOrDefault(q.getId(), List.of()));

            JsonNode conditionJson = json(link.getConditionalRules(), where + " conditional_rules", problems);
            Condition condition = null;
            try {
                condition = ConditionParser.parse(conditionJson);
            } catch (IllegalArgumentException exception) {
                problems.add(where + " conditional_rules: " + exception.getMessage());
            }
            questionsByStep.computeIfAbsent(link.getStep().getId(), k -> new ArrayList<>())
                    .add(new StepQuestion(question, link.getSortOrder(), link.isActive(), conditionJson, condition));
        }

        // Bước RESULT không có câu hỏi và không thuộc luồng trả lời -> không đưa vào định nghĩa phiên
        List<StepDefinition> stepDefinitions = new ArrayList<>();
        for (SurveyStep step : steps.findBySurveyIdOrderBySortOrderAsc(survey.getId())) {
            if (step.isResult()) {
                if (questionsByStep.containsKey(step.getId())) {
                    problems.add("Step " + step.getStepCode() + " is a RESULT step and must not contain questions");
                }
                continue;
            }
            stepDefinitions.add(new StepDefinition(step.getStepCode(), step.getStepName(), step.getDescription(),
                    step.getSortOrder(), step.getStatus() == SurveyStep.Status.ACTIVE,
                    questionsByStep.getOrDefault(step.getId(), List.of())));
        }

        SurveyDefinition definition = new SurveyDefinition(survey.getId(), survey.getSurveyCode(),
                survey.getSurveyName(), survey.getDescription(), survey.getVersion(), stepDefinitions);
        if (problems.isEmpty()) {
            problems.addAll(validator.validate(definition));
        }
        return definition;
    }

    private static OptionDefinition toOption(AssessmentOption o) {
        return new OptionDefinition(o.getOptionCode(), o.getOptionLabel(), o.getOptionValue(), o.getSortOrder(),
                o.getStatus() == ConfigStatus.ACTIVE);
    }

    private static JsonNode json(String raw, String where, List<String> problems) {
        try {
            return SurveyJson.parse(raw);
        } catch (IllegalArgumentException exception) {
            problems.add(where + " is not valid JSON");
            return null;
        }
    }
}
