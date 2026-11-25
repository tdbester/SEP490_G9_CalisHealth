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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho cac nhanh bien cua {@link ExerciseUnlockService}. */
class ExerciseUnlockServiceExtraCoverageTest {
    private ProgressionRuleRepository rules;
    private MemberSkillProgressRepository skillProgress;
    private MemberProfileRepository memberProfiles;
    private ExerciseUnlockService service;

    @BeforeEach
    void setUp() {
        rules = mock(ProgressionRuleRepository.class);
        skillProgress = mock(MemberSkillProgressRepository.class);
        memberProfiles = mock(MemberProfileRepository.class);
        service = new ExerciseUnlockService(rules, skillProgress, memberProfiles, mock(UserRepository.class));
    }

    private static Exercise entry(Long id, String name) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode("EX-" + id);
        exercise.setName(name);
        exercise.setSource("SYSTEM");
        return exercise;
    }

    private static ProgressionRule rule(Exercise exercise, Exercise prerequisite) {
        ProgressionRule rule = new ProgressionRule();
        rule.setExercise(exercise);
        rule.setPrerequisiteExercise(prerequisite);
        rule.setStatus(ProgressionRuleService.STATUS_ACTIVE);
        return rule;
    }

    @Test
    @DisplayName("isLocked: id null -> false")
    void isLockedWithNullIdsIsFalse() {
        assertThat(service.isLocked(null, 5L)).isFalse();
        assertThat(service.isLocked(1L, null)).isFalse();
    }

    @Test
    @DisplayName("lockedExerciseIds: danh sach rong -> set rong")
    void lockedExerciseIdsWithEmptyInputIsEmpty() {
        assertThat(service.lockedExerciseIds(List.of(), 5L)).isEmpty();
        assertThat(service.lockedExerciseIds(null, 5L)).isEmpty();
        assertThat(service.lockedExerciseIds(List.of(1L), null)).isEmpty();
    }

    @Test
    @DisplayName("loadSkillStates: member null -> map rong")
    void loadSkillStatesWithNullMemberIsEmpty() {
        Exercise root = entry(1L, "Root");
        Exercise child = entry(2L, "Child");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(rule(child, root)));

        Map<Long, String> states = service.statesByExercise(null);

        assertThat(states.get(1L)).isEqualTo(ExerciseUnlockService.STATE_CURRENT);
        assertThat(states.get(2L)).isEqualTo(ExerciseUnlockService.STATE_LOCKED);
    }

    @Test
    @DisplayName("loadSkillStates: khong co member profile -> map rong")
    void loadSkillStatesWithoutProfileIsEmpty() {
        Exercise root = entry(1L, "Root");
        Exercise child = entry(2L, "Child");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(rule(child, root)));
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.empty());

        Map<Long, String> states = service.statesByExercise(5L);

        assertThat(states.get(2L)).isEqualTo(ExerciseUnlockService.STATE_LOCKED);
    }

    @Test
    @DisplayName("loadSkillStates: dong tien do khong gan bai tap -> bo qua")
    void progressRowWithoutExerciseIsIgnored() {
        Exercise root = entry(1L, "Root");
        Exercise child = entry(2L, "Child");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(rule(child, root)));

        MemberProfile profile = new MemberProfile();
        profile.setId(77L);
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.of(profile));
        when(skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(eq(77L), anyCollection()))
                .thenReturn(List.of(new MemberSkillProgress()));

        Map<Long, String> states = service.statesByExercise(5L);

        assertThat(states.get(1L)).isEqualTo(ExerciseUnlockService.STATE_CURRENT);
    }

    @Test
    @DisplayName("loadSkillStates: tien do IN_PROGRESS -> CURRENT")
    void inProgressSkillBecomesCurrent() {
        Exercise root = entry(1L, "Root");
        Exercise child = entry(2L, "Child");
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of(rule(child, root)));

        MemberProfile profile = new MemberProfile();
        profile.setId(77L);
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.of(profile));
        MemberSkillProgress progress = new MemberSkillProgress();
        progress.setExercise(root);
        progress.setStatus("IN_PROGRESS");
        when(skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(eq(77L), anyCollection()))
                .thenReturn(List.of(progress));

        Map<Long, String> states = service.statesByExercise(5L);

        assertThat(states.get(1L)).isEqualTo(ExerciseUnlockService.STATE_CURRENT);
    }

    @Test
    @DisplayName("requireUnlocked: bai khong bi khoa -> khong nem loi")
    void requireUnlockedPassesForUnlockedExercise() {
        when(rules.findAllByOrderByIdAsc()).thenReturn(List.of());

        assertThatCode(() -> service.requireUnlocked(999L, 5L)).doesNotThrowAnyException();
    }
}
