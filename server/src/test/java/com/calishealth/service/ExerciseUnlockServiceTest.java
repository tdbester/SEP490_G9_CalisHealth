package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberSkillProgress;
import com.calishealth.models.ProgressionRule;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberSkillProgressRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Quy tắc "member chỉ tập được bài đã mở khoá trong Exercise Tree".
 *
 * <p>Trạng thái mở khoá được tính từ đồ thị {@code progression_rules} + tiến độ thực tế
 * của member trong {@code member_skill_progress}.</p>
 */
class ExerciseUnlockServiceTest {
    private ProgressionRuleRepository rules;
    private MemberSkillProgressRepository skillProgress;
    private MemberProfileRepository memberProfiles;
    private ExerciseUnlockService service;

    @BeforeEach
    void setUp() {
        rules = mock(ProgressionRuleRepository.class);
        skillProgress = mock(MemberSkillProgressRepository.class);
        memberProfiles = mock(MemberProfileRepository.class);
        service = new ExerciseUnlockService(
                rules,
                skillProgress,
                memberProfiles,
                mock(UserRepository.class));
    }

    @Test
    void rootExerciseIsNeverLockedSoANewMemberCanStartTraining() {
        Exercise root = entry(1L, "Incline push-up");
        Exercise child = entry(2L, "Push-up");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(rule(child, root)));

        Map<Long, String> states = service.statesByExercise(5L);

        // Bai goc khong co tien kien -> CURRENT (khong LOCKED) -> member moi khong bi ket.
        assertThat(states.get(1L)).isEqualTo(ExerciseUnlockService.STATE_CURRENT);
        assertThat(states.get(2L)).isEqualTo(ExerciseUnlockService.STATE_LOCKED);
    }

    @Test
    void aChildBecomesCurrentOnceItsPrerequisiteIsMastered() {
        Exercise root = entry(1L, "Incline push-up");
        Exercise child = entry(2L, "Push-up");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(rule(child, root)));

        MemberProfile profile = new MemberProfile();
        profile.setId(77L);
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.of(profile));
        when(skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(eq(77L), anyCollection()))
                .thenReturn(List.of(skill(root, ProgressionRuleService.PROGRESS_UNLOCKED)));

        Map<Long, String> states = service.statesByExercise(5L);

        assertThat(states.get(1L)).isEqualTo(ExerciseUnlockService.STATE_MASTERED);
        assertThat(states.get(2L)).isEqualTo(ExerciseUnlockService.STATE_CURRENT);
    }

    @Test
    void exercisesOutsideTheProgressionTreeAreAlwaysTrainable() {
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of());

        // Bai khong nam trong cay -> khong co gi de mo khoa -> tap duoc.
        assertThat(service.isLocked(999L, 5L)).isFalse();
        assertThatCode(() -> service.requireUnlocked(999L, 5L)).doesNotThrowAnyException();
    }

    @Test
    void requireUnlockedRejectsALockedExercise() {
        Exercise root = entry(1L, "Incline push-up");
        Exercise child = entry(2L, "Push-up");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(rule(child, root)));

        assertThatThrownBy(() -> service.requireUnlocked(2L, 5L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("locked");
    }

    @Test
    void lockedExerciseIdsReportsOnlyTheLockedOnesOfAWorkout() {
        Exercise root = entry(1L, "Incline push-up");
        Exercise childA = entry(2L, "Push-up");
        Exercise childB = entry(3L, "Diamond push-up");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(
                rule(childA, root),
                rule(childB, root)));

        // Workout co ca 2 bai con -> ca 2 deu dang khoa -> khong tap duoc workout.
        assertThat(service.lockedExerciseIds(List.of(1L, 2L, 3L), 5L))
                .containsExactlyInAnyOrder(2L, 3L);
        // Workout chi co bai goc -> tap duoc.
        assertThat(service.lockedExerciseIds(List.of(1L), 5L)).isEmpty();
    }

    private MemberSkillProgress skill(Exercise exercise, String status) {
        MemberSkillProgress progress = new MemberSkillProgress();
        progress.setExercise(exercise);
        progress.setStatus(status);
        return progress;
    }

    private Exercise entry(Long id, String name) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode("EX-" + id);
        exercise.setName(name);
        exercise.setSource("SYSTEM");
        return exercise;
    }

    private ProgressionRule rule(Exercise exercise, Exercise prerequisite) {
        ProgressionRule rule = new ProgressionRule();
        rule.setExercise(exercise);
        rule.setPrerequisiteExercise(prerequisite);
        rule.setStatus(ProgressionRuleService.STATUS_ACTIVE);
        return rule;
    }
}
