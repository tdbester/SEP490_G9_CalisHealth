package com.calishealth.dtos;

import com.calishealth.dtos.SurveyDtos.SaveAnswersRequest;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/** Phân biệt "không gửi value", "value: null" và field lạ trong 1 câu trả lời. */
class SurveyDtosJsonTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void distinguishesMissingNullAndUnknownFields() {
        SaveAnswersRequest request = mapper.readValue("""
                {"surveyVersion": 1, "answers": [
                  {"questionCode": "AGE", "value": 22},
                  {"questionCode": "HEIGHT", "value": null},
                  {"questionCode": "WEIGHT"},
                  {"questionCode": "GENDER", "value": "MALE", "questionType": "TEXT"}
                ]}
                """, SaveAnswersRequest.class);

        var answers = request.answers();
        assertThat(answers.get(0).isValuePresent()).isTrue();
        assertThat(answers.get(0).getValue().asInt()).isEqualTo(22);

        assertThat(answers.get(1).isValuePresent()).isTrue();
        assertThat(answers.get(1).getValue()).isNotNull();
        assertThat(answers.get(1).getValue().isNull()).isTrue();

        assertThat(answers.get(2).isValuePresent()).isFalse();

        assertThat(answers.get(3).getUnknownFields()).containsOnlyKeys("questionType");
        assertThat(request.surveyVersion()).isEqualTo(1);
    }
}
