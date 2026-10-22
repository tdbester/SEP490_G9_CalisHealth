package com.calishealth.service.survey.definition;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/** Toàn bộ cấu hình của 1 survey version (gồm cả phần INACTIVE để báo lỗi chính xác). */
public record SurveyDefinition(
        Long surveyId,
        String code,
        String name,
        String description,
        int version,
        List<StepDefinition> steps
) {
    public SurveyDefinition {
        steps = List.copyOf(steps);
    }

    public Optional<StepDefinition> step(String stepCode) {
        return steps.stream().filter(s -> s.code().equals(stepCode)).findFirst();
    }

    public List<StepDefinition> activeSteps() {
        return steps.stream().filter(StepDefinition::active).toList();
    }

    /** Câu hỏi theo đúng thứ tự hiển thị trên toàn khảo sát. */
    public Stream<StepQuestion> allQuestions() {
        return steps.stream().flatMap(s -> s.questions().stream());
    }

    public Optional<StepDefinition> stepOf(String questionCode) {
        return steps.stream().filter(s -> s.question(questionCode).isPresent()).findFirst();
    }
}
