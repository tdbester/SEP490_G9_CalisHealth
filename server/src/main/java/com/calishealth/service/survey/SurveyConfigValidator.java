package com.calishealth.service.survey;

import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import com.calishealth.service.survey.questiontype.QuestionTypeHandler;
import com.calishealth.service.survey.questiontype.QuestionTypeRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Kiểm tra cấu hình 1 survey version trước khi dùng. Chỉ xét phần đang ACTIVE để quản trị viên
 * có thể vô hiệu hóa câu hỏi lỗi mà không làm sập cả khảo sát.
 */
@Component
@RequiredArgsConstructor
public class SurveyConfigValidator {
    private final QuestionTypeRegistry registry;

    public List<String> validate(SurveyDefinition survey) {
        List<String> problems = new ArrayList<>();
        // questionCode -> vị trí xuất hiện (để bắt điều kiện trỏ tới câu đứng sau / chính nó)
        Map<String, Integer> position = new HashMap<>();
        int index = 0;

        for (StepDefinition step : survey.activeSteps()) {
            for (StepQuestion stepQuestion : step.questions()) {
                if (!stepQuestion.active()) {
                    continue;
                }
                QuestionDefinition question = stepQuestion.question();
                String where = "Question " + question.code() + " (step " + step.code() + ")";

                if (position.putIfAbsent(question.code(), index++) != null) {
                    problems.add(where + ": appears more than once in the survey");
                    continue;
                }
                Optional<QuestionTypeHandler> handler = registry.find(question.type());
                if (handler.isEmpty()) {
                    problems.add(where + ": unsupported question type '" + question.type()
                            + "' (supported: " + registry.supportedTypes() + ")");
                } else {
                    handler.get().validateConfig(question).forEach(p -> problems.add(where + ": " + p));
                }

                if (stepQuestion.condition() != null) {
                    for (String source : stepQuestion.condition().referencedQuestions()) {
                        Integer sourcePosition = position.get(source);
                        if (sourcePosition == null || source.equals(question.code())) {
                            problems.add(where + ": condition references '" + source
                                    + "', which must be an active question placed earlier in the survey");
                        }
                    }
                }
            }
        }
        return problems;
    }
}
