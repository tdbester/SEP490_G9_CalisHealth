package com.calishealth.service.survey.definition;

import com.calishealth.service.survey.SurveyJson;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Optional;

/**
 * Ảnh chụp bất biến của 1 câu hỏi đã đọc từ DB. Handler chỉ làm việc với record này
 * (không phụ thuộc JPA) nên dễ unit test.
 */
public record QuestionDefinition(
        Long id,
        String code,
        String text,
        String description,
        String type,
        boolean required,
        JsonNode validationRules,
        JsonNode displayConfig,
        String unit,
        JsonNode defaultValue,
        boolean active,
        List<OptionDefinition> options
) {
    public QuestionDefinition {
        validationRules = SurveyJson.isNull(validationRules) ? SurveyJson.nodes().objectNode() : validationRules;
        options = options == null ? List.of() : List.copyOf(options);
    }

    public List<OptionDefinition> activeOptions() {
        return options.stream().filter(OptionDefinition::active).toList();
    }

    public Optional<OptionDefinition> activeOption(String optionCode) {
        return options.stream().filter(o -> o.active() && o.code().equals(optionCode)).findFirst();
    }

    /** Giá trị 1 rule, hoặc null nếu không cấu hình. */
    public JsonNode rule(String key) {
        JsonNode node = validationRules.get(key);
        return SurveyJson.isNull(node) ? null : node;
    }
}
