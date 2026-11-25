package com.calishealth.service;

import com.calishealth.models.FormRule;
import com.calishealth.repository.FormRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test {@link FormRuleSuggestionService}: gợi ý ngưỡng cho member được tính từ
 * trung bình các bài trong cùng nhóm chuyển động.
 */
class FormRuleSuggestionServiceTest {

    private FormRuleRepository formRules;
    private FormRuleSuggestionService service;

    @BeforeEach
    void setUp() {
        formRules = mock(FormRuleRepository.class);
        service = new FormRuleSuggestionService(formRules);
    }

    private static FormRule rule(String joint, String threshold, String depth,
                                 String minAngle, String maxAngle, String weight) {
        FormRule rule = new FormRule();
        rule.setJoint(joint);
        rule.setAngleThreshold(threshold == null ? null : new BigDecimal(threshold));
        rule.setRomDepth(depth == null ? null : new BigDecimal(depth));
        rule.setMinAngle(minAngle == null ? null : new BigDecimal(minAngle));
        rule.setMaxAngle(maxAngle == null ? null : new BigDecimal(maxAngle));
        rule.setWeight(weight == null ? null : new BigDecimal(weight));
        rule.setTolerance(new BigDecimal("20"));
        return rule;
    }

    @Test
    @DisplayName("suggest: tinh trung binh theo khớp cua nhom chuyen dong")
    void averagesByJoint() {
        when(formRules.findByMovementGroup("PUSH", "REPS")).thenReturn(List.of(
                rule("ELBOW", "165", "97", null, null, "0.30"),
                rule("ELBOW", "155", "97", null, null, "0.30"),
                rule("HIP", "160", "80", null, null, "0.25")));

        var response = service.suggest("PUSH", "REPS");

        assertThat(response.movementGroup()).isEqualTo("PUSH");
        assertThat(response.category()).isEqualTo("REPS");
        assertThat(response.sampleSize()).isEqualTo(3);
        assertThat(response.suggestions()).hasSize(2);

        var elbow = response.suggestions().get(0);
        assertThat(elbow.joint()).isEqualTo("ELBOW");
        assertThat(elbow.angleThreshold()).isEqualByComparingTo("160");
        assertThat(elbow.romDepth()).isEqualByComparingTo("97");
        assertThat(elbow.similarCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("suggest: khong co rule nao -> goi y rong")
    void returnsEmptyWhenNoRules() {
        when(formRules.findByMovementGroup("CORE", "HOLD")).thenReturn(List.of());

        var response = service.suggest("CORE", "HOLD");

        assertThat(response.suggestions()).isEmpty();
        assertThat(response.sampleSize()).isZero();
    }

    @Test
    @DisplayName("suggest: rule khong co khớp -> bo qua")
    void skipsRuleWithoutJoint() {
        when(formRules.findByMovementGroup("LEGS", null)).thenReturn(List.of(
                rule(null, "90", "100", null, null, "0.60")));

        var response = service.suggest("LEGS", null);

        assertThat(response.suggestions()).isEmpty();
        assertThat(response.sampleSize()).isEqualTo(1);
    }

    @Test
    @DisplayName("suggest: chuan hoa nhom chuyen dong va loai bai")
    void normalisesInput() {
        when(formRules.findByMovementGroup("PULL", "REPS")).thenReturn(List.of());

        var response = service.suggest("  pull  ", " reps ");

        assertThat(response.movementGroup()).isEqualTo("PULL");
        assertThat(response.category()).isEqualTo("REPS");
    }

    @Test
    @DisplayName("suggest: rule thiếu thuộc tính -> gia tri null, khong loi")
    void toleratesMissingValues() {
        when(formRules.findByMovementGroup("PUSH", "REPS")).thenReturn(List.of(
                rule("ELBOW", null, null, "165", "180", null)));

        var response = service.suggest("PUSH", "REPS");

        assertThat(response.suggestions()).hasSize(1);
        var elbow = response.suggestions().get(0);
        assertThat(elbow.angleThreshold()).isNull();
        assertThat(elbow.romDepth()).isNull();
        assertThat(elbow.minAngle()).isEqualByComparingTo("165");
        assertThat(elbow.maxAngle()).isEqualByComparingTo("180");
        assertThat(elbow.weight()).isNull();
    }
}
