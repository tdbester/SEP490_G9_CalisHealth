package com.calishealth.service;

import com.calishealth.dtos.FormCorrectionDtos.CorrectionTip;
import com.calishealth.dtos.FormCorrectionDtos.FormCorrectionPlanResponse;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link FormCorrectionService}: dựng kế hoạch sửa form cho một bài tập.
 */
class FormCorrectionServiceTest {

    private ExerciseRepository exercises;
    private FormRuleRepository formRules;
    private FormCorrectionService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        formRules = mock(FormRuleRepository.class);
        service = new FormCorrectionService(exercises, formRules);
    }

    private static Exercise exercise(String code, String name, String category) {
        Exercise e = new Exercise();
        e.setCode(code);
        e.setName(name);
        e.setCategory(category);
        return e;
    }

    private static FormRule rule(String joint) {
        FormRule r = new FormRule();
        r.setJoint(joint);        r.setAngleThreshold(new BigDecimal("90"));
        r.setRomDepth(new BigDecimal("70"));
        return r;
    }

    @Test
    @DisplayName("plan: khong tim thay bai -> 404")
    void planRejectsUnknownExercise() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.plan("EX_1", List.of()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("plan: tra ve cac nguong cham form cua bai")
    void planReturnsRules() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of(rule("KNEE")));

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of());

        assertThat(plan.exerciseCode()).isEqualTo("EX_1");
        assertThat(plan.exerciseName()).isEqualTo("Squat");
        assertThat(plan.rules()).hasSize(1);
        assertThat(plan.rules().get(0).joint()).isEqualTo("KNEE");
        assertThat(plan.rules().get(0).targetAngle()).isEqualByComparingTo("90");
    }

    @Test
    @DisplayName("plan: cau nhac cua Content Manager duoc dua len dau")
    void planPrefersContentManagerFeedback() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of(rule("KNEE")));

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of("KNEE"));

        assertThat(plan.howToFix().get(0).title()).isEqualTo("Push knees outward along your toes");
        assertThat(plan.howToFix().get(0).joint()).isEqualTo("KNEE");
    }

    @Test
    @DisplayName("plan: khop khong co rule -> dung meo chung theo khop")
    void planFallsBackToJointTips() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of());

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of("KNEE"));

        assertThat(plan.howToFix()).isNotEmpty();
        assertThat(plan.howToFix().get(0).joint()).isEqualTo("KNEE");
    }

    @Test
    @DisplayName("plan: cau nhac rong -> bo qua")
    void planSkipsBlankFeedback() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of(rule("KNEE")));

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of("KNEE"));

        assertThat(plan.howToFix().get(0).joint()).isEqualTo("KNEE");
        assertThat(plan.howToFix().get(0).title()).isNotBlank();
    }

    @Test
    @DisplayName("plan: bai HOLD -> dung meo giu tu the")
    void planUsesHoldTipsForHoldExercises() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Plank", "HOLD")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of());

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of("KNEE"));

        assertThat(plan.howToFix()).isNotEmpty();
        assertThat(plan.howToFix()).allSatisfy(tip -> assertThat(tip.detail()).isNotBlank());
    }

    @Test
    @DisplayName("plan: toi da 3 buoc sua")
    void planLimitsTipsToThree() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of(
                rule("KNEE"), rule("HIP")));

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of("KNEE", "HIP"));

        assertThat(plan.howToFix()).hasSizeLessThanOrEqualTo(3);
    }

    @Test
    @DisplayName("plan: khong co rule va khong co loi -> van co meo nhip do")
    void planAlwaysFillsWithTempoTips() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of());

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of());

        assertThat(plan.howToFix()).isNotEmpty();
        assertThat(plan.howToFix().get(0).title()).isNotBlank();
    }

    @Test
    @DisplayName("plan: bo qua meo trung y")
    void planSkipsDuplicateTips() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of(
                rule("KNEE")));

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of("KNEE"));

        List<CorrectionTip> tips = plan.howToFix();
        assertThat(tips).hasSizeGreaterThan(1);
        assertThat(tips.get(0).title()).isNotEqualTo(tips.get(1).title());
    }

    @Test
    @DisplayName("plan: khong co loi nao -> dung meo theo cac khop dang theo doi")
    void planUsesMonitoredJointsWhenNoFailure() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.of(exercise("EX_1", "Squat", "REPS")));
        when(formRules.findByExerciseCode("EX_1")).thenReturn(List.of(rule("HIP")));

        FormCorrectionPlanResponse plan = service.plan("EX_1", List.of());

        assertThat(plan.howToFix()).isNotEmpty();
    }
}
