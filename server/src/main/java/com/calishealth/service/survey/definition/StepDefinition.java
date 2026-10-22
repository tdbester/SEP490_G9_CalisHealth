package com.calishealth.service.survey.definition;

import java.util.List;
import java.util.Optional;

public record StepDefinition(
        String code,
        String name,
        String description,
        int sortOrder,
        boolean active,
        List<StepQuestion> questions
) {
    public StepDefinition {
        questions = List.copyOf(questions);
    }

    public Optional<StepQuestion> question(String questionCode) {
        return questions.stream().filter(q -> q.question().code().equals(questionCode)).findFirst();
    }
}
