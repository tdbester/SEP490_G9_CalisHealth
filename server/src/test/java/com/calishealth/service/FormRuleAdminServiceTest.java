package com.calishealth.service;

import com.calishealth.dtos.FormRuleAdminDtos.FormRuleInput;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulesRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.FormRule;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FormRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test {@link FormRuleAdminService}: đọc / khai báo lại ngưỡng chấm form và
 * các nhánh validate.
 */
class FormRuleAdminServiceTest {

    private ExerciseRepository exercises;
    private FormRuleRepository formRules;
    private FormRuleAdminService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        formRules = mock(FormRuleRepository.class);
        service = new FormRuleAdminService(exercises, formRules);
    }

    private static Exercise exercise(long id, String code, String name) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode(code);
        exercise.setName(name);
        return exercise;
    }

    private static FormRule rule(Long id, String joint) {
        FormRule rule = new FormRule();
        rule.setId(id);
        rule.setJoint(joint);
        rule.setAngleThreshold(new BigDecimal("165.000"));
        rule.setRomDepth(new BigDecimal("97.000"));
        rule.setMinAngle(new BigDecimal("165.000"));
        rule.setMaxAngle(new BigDecimal("180.000"));
        rule.setWeight(new BigDecimal("0.30"));
        rule.setTolerance(new BigDecimal("20.000"));
        rule.setSource("DEFAULT");
        return rule;
    }

    @Test
    @DisplayName("getFormRules: tra ve day du rule cua bai")
    void returnsRules() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of(rule(5L, "ELBOW")));

        var view = service.getFormRules("EX_1");

        assertThat(view.exerciseCode()).isEqualTo("EX_1");
        assertThat(view.exerciseName()).isEqualTo("Push-up");
        assertThat(view.rules()).hasSize(1);
        assertThat(view.rules().get(0).joint()).isEqualTo("ELBOW");
        assertThat(view.rules().get(0).weight()).isEqualByComparingTo("0.30");
        assertThat(view.rules().get(0).source()).isEqualTo("DEFAULT");
    }

    @Test
    @DisplayName("getFormRules: ma bai rong -> 400")
    void rejectsBlankCode() {
        assertThatThrownBy(() -> service.getFormRules("  "))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getFormRules: bai khong ton tai -> 404")
    void rejectsUnknownExercise() {
        when(exercises.findByCode("EX_X")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getFormRules("EX_X"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("replaceFormRules: xoa rule cu va luu rule moi")
    void replacesRules() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        when(formRules.save(any(FormRule.class))).thenAnswer(inv -> inv.getArgument(0));

        var input = new FormRuleInput("elbow", new BigDecimal("165"), new BigDecimal("97"),
                null, null, null, null);
        var view = service.replaceFormRules("EX_1", new FormRulesRequest(List.of(input)),
                FormRuleAdminService.SOURCE_CONTENT_MANAGER);

        verify(formRules).deleteByExerciseId(1L);
        verify(formRules).save(any(FormRule.class));
        assertThat(view.rules()).hasSize(1);
        assertThat(view.rules().get(0).joint()).isEqualTo("ELBOW");
        // weight/tolerance rỗng -> lấy mặc định.
        assertThat(view.rules().get(0).weight()).isEqualByComparingTo("0.30");
        assertThat(view.rules().get(0).tolerance()).isEqualByComparingTo("15");
        assertThat(view.rules().get(0).source()).isEqualTo(FormRuleAdminService.SOURCE_CONTENT_MANAGER);
    }

    @Test
    @DisplayName("replaceFormRules: request null -> 400")
    void rejectsEmptyRules() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));

        assertThatThrownBy(() -> service.replaceFormRules("EX_1",
                new FormRulesRequest(List.of()), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: khớp lạ -> 400")
    void rejectsUnknownJoint() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        var input = new FormRuleInput("SPINE", new BigDecimal("165"), null,
                null, null, null, null);

        assertThatThrownBy(() -> service.replaceFormRules("EX_1",
                new FormRulesRequest(List.of(input)), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: góc ngoài 0..180 -> 400")
    void rejectsOutOfRangeAngle() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        var input = new FormRuleInput("ELBOW", new BigDecimal("200"), null,
                null, null, null, null);

        assertThatThrownBy(() -> service.replaceFormRules("EX_1",
                new FormRulesRequest(List.of(input)), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: minAngle > maxAngle -> 400")
    void rejectsInvertedRange() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        var input = new FormRuleInput("HIP", null, null,
                new BigDecimal("180"), new BigDecimal("160"), null, null);

        assertThatThrownBy(() -> service.replaceFormRules("EX_1",
                new FormRulesRequest(List.of(input)), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: trọng số ngoài 0..1 -> 400")
    void rejectsInvalidWeight() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        var input = new FormRuleInput("ELBOW", new BigDecimal("165"), null,
                null, null, new BigDecimal("1.5"), null);

        assertThatThrownBy(() -> service.replaceFormRules("EX_1",
                new FormRulesRequest(List.of(input)), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: rule không có ngưỡng nào -> 400")
    void rejectsRuleWithoutThresholds() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        var input = new FormRuleInput("ELBOW", null, null,
                null, null, null, null);

        assertThatThrownBy(() -> service.replaceFormRules("EX_1",
                new FormRulesRequest(List.of(input)), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: request null -> 400")
    void rejectsNullRequest() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));

        assertThatThrownBy(() -> service.replaceFormRules(
                "EX_1", null, FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: rules null -> 400")
    void rejectsNullRuleList() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));

        assertThatThrownBy(() -> service.replaceFormRules(
                "EX_1", new FormRulesRequest(null), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: ma bai rong -> 400")
    void rejectsBlankExerciseCode() {
        assertThatThrownBy(() -> service.replaceFormRules(
                " ", new FormRulesRequest(List.of()), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("replaceFormRules: bai khong ton tai -> 404")
    void replaceRejectsUnknownExercise() {
        when(exercises.findByCode("EX_X")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.replaceFormRules(
                "EX_X", new FormRulesRequest(List.of()), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("replaceFormRules: quá 6 rule -> 400")
    void rejectsTooManyRules() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise(1L, "EX_1", "Push-up")));
        var input = new FormRuleInput("ELBOW", new BigDecimal("165"), null,
                null, null, null, null);
        var inputs = java.util.stream.IntStream.range(0, 7)
                .mapToObj(index -> input)
                .toList();

        assertThatThrownBy(() -> service.replaceFormRules("EX_1",
                new FormRulesRequest(inputs), FormRuleAdminService.SOURCE_CONTENT_MANAGER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
