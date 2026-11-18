package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberSkillProgress;
import com.calishealth.models.ProgressionRule;
import com.calishealth.models.User;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberSkillProgressRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExerciseTreeServiceTest {
    private ProgressionRuleService progressionRules;
    private MemberSkillProgressRepository skillProgress;
    private MemberProfileRepository memberProfiles;
    private UserRepository users;
    private ExerciseUnlockService unlockService;
    private ExerciseTreeService service;

    @BeforeEach
    void setUp() {
        progressionRules = mock(ProgressionRuleService.class);
        skillProgress = mock(MemberSkillProgressRepository.class);
        memberProfiles = mock(MemberProfileRepository.class);
        users = mock(UserRepository.class);
        unlockService = mock(ExerciseUnlockService.class);
        service = new ExerciseTreeService(progressionRules, users, unlockService);
    }

    @Test
    void sortsTreeAndUnlocksOnlyNodesWhosePrerequisitesAreMastered() {
        User member = new User();
        member.setId(5L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        MemberProfile profile = new MemberProfile();
        profile.setId(77L);
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.of(profile));

        Exercise levelOne = entry(101L, "Incline push-up");
        Exercise levelTwo = entry(102L, "Push-up");
        Exercise levelThree = entry(103L, "Diamond push-up");
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(
                rule(levelTwo, levelOne),
                rule(levelThree, levelTwo)));

        // member đã chinh phục bài level 1 -> trạng thái MASTERED trong cây.
        when(skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(eq(77L), anyCollection()))
                .thenReturn(List.of(skill(levelOne, ProgressionRuleService.PROGRESS_UNLOCKED)));

        // Trạng thái do ExerciseUnlockService tính (dùng chung với luồng chặn tập).
        when(unlockService.statesByExercise(5L)).thenReturn(Map.of(
                101L, ExerciseUnlockService.STATE_MASTERED,
                102L, ExerciseUnlockService.STATE_CURRENT,
                103L, ExerciseUnlockService.STATE_LOCKED));

        var result = service.getTree(
                ExerciseTreeService.TreeOrder.HARD_TO_EASY,
                "member@example.com");

        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::id).containsExactly(103L, 102L, 101L);
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::code).containsExactly("EX-103", "EX-102", "EX-101");
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::state).containsExactly("LOCKED", "CURRENT", "MASTERED");
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::difficulty)
                .containsOnly("Beginner");
        assertThat(result.nodes().get(1).prerequisiteIds()).containsExactly(101L);
        assertThat(result.nodes().get(1).nextExerciseIds()).containsExactly(103L);
        assertThat(result.edges()).hasSize(2);
        assertThat(result.edges()).allMatch(edge -> "ACTIVE".equals(edge.status()));
    }

    @Test
    void includesInactiveCrossGroupRulesLikeContentManagerTree() {
        User member = new User();
        member.setId(5L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        MemberProfile profile = new MemberProfile();
        profile.setId(77L);
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.of(profile));

        Exercise plank = entry(201L, "Plank");
        Exercise handstand = entry(202L, "Handstand");
        handstand.setMovementGroup(Exercise.MovementGroup.PUSH);
        ProgressionRule activeRule = rule(handstand, plank);
        ProgressionRule inactiveRule = rule(entry(203L, "Hollow Body Hold"), plank);
        inactiveRule.setStatus("INACTIVE");
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(activeRule, inactiveRule));
        when(skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(eq(77L), anyCollection()))
                .thenReturn(List.of());
        when(unlockService.statesByExercise(5L)).thenReturn(Map.of(
                201L, ExerciseUnlockService.STATE_CURRENT,
                202L, ExerciseUnlockService.STATE_CURRENT,
                203L, ExerciseUnlockService.STATE_CURRENT));

        var result = service.getTree(
                ExerciseTreeService.TreeOrder.EASY_TO_HARD,
                "member@example.com");

        assertThat(result.movementGroup()).isEqualTo("ALL");
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::code)
                .containsExactly("EX-201", "EX-202", "EX-203");
        assertThat(result.edges()).extracting(
                com.calishealth.dtos.ExerciseTreeEdgeDTO::status)
                .containsExactly("ACTIVE", "INACTIVE");
        assertThat(result.nodes()).filteredOn(
                node -> "EX-203".equals(node.code()))
                .extracting(com.calishealth.dtos.ExerciseTreeNodeDTO::state)
                .containsExactly("CURRENT");
    }

    @Test
    void memberWithoutProfileFallsBackToPrerequisiteOnlyStates() {
        User member = new User();
        member.setId(5L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.empty());

        Exercise levelOne = entry(101L, "Incline push-up");
        Exercise levelTwo = entry(102L, "Push-up");
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(rule(levelTwo, levelOne)));
        when(unlockService.statesByExercise(5L)).thenReturn(Map.of(
                101L, ExerciseUnlockService.STATE_CURRENT,
                102L, ExerciseUnlockService.STATE_LOCKED));

        var result = service.getTree(
                ExerciseTreeService.TreeOrder.EASY_TO_HARD,
                "member@example.com");

        // Không có hồ sơ -> không có dòng tiến độ nào: bài gốc CURRENT, bài có prerequisite chưa
        // chinh phục thì LOCKED (giống hệt logic cây trước khi bỏ member_exercise_progress).
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::state).containsExactly("CURRENT", "LOCKED");
    }

    @Test
    void computesTreeLevelFromTheProgressionGraphInsteadOfAStoredColumn() {
        User member = new User();
        member.setId(5L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.empty());

        // Chuỗi 3 bài: A -> B -> C. Do sau phai la 1, 2, 3 - tinh tu do thi rule.
        Exercise a = entry(101L, "Incline push-up");
        Exercise b = entry(102L, "Push-up");
        Exercise c = entry(103L, "Diamond push-up");
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(
                rule(b, a),
                rule(c, b)));
        when(unlockService.statesByExercise(5L)).thenReturn(Map.of(
                101L, ExerciseUnlockService.STATE_CURRENT,
                102L, ExerciseUnlockService.STATE_CURRENT,
                103L, ExerciseUnlockService.STATE_CURRENT));

        var result = service.getTree(
                ExerciseTreeService.TreeOrder.EASY_TO_HARD,
                "member@example.com");

        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::code).containsExactly("EX-101", "EX-102", "EX-103");
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::level).containsExactly(1, 2, 3);
    }

    @Test
    void handlesACycleInTheProgressionGraphWithoutLoopingForever() {
        User member = new User();
        member.setId(5L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.empty());

        // Vong: A -> B -> A. Khong co bai goc nao, nhung phai tra ve du lieu, khong treo.
        Exercise a = entry(101L, "Incline push-up");
        Exercise b = entry(102L, "Push-up");
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(
                rule(b, a),
                rule(a, b)));
        when(unlockService.statesByExercise(5L)).thenReturn(Map.of(
                101L, ExerciseUnlockService.STATE_LOCKED,
                102L, ExerciseUnlockService.STATE_LOCKED));

        var result = service.getTree(
                ExerciseTreeService.TreeOrder.EASY_TO_HARD,
                "member@example.com");

        assertThat(result.nodes()).hasSize(2);
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::level).doesNotContainNull();
    }

    private MemberSkillProgress skill(Exercise exercise, String status) {
        MemberSkillProgress progress = new MemberSkillProgress();
        progress.setExercise(exercise);
        progress.setStatus(status);
        return progress;
    }

    private Exercise entry(Long id, String name) {
        Exercise entry = new Exercise();
        entry.setId(id);
        entry.setCode("EX-" + id);
        entry.setName(name);
        entry.setSource("SYSTEM");
        entry.setMovementGroup(Exercise.MovementGroup.PUSH);
        entry.setDifficultyLevel("BEGINNER");
        entry.setMuscleGroup("Chest");
        return entry;
    }

    private ProgressionRule rule(Exercise exercise, Exercise prerequisite) {
        ProgressionRule rule = new ProgressionRule();
        rule.setExercise(exercise);
        rule.setPrerequisiteExercise(prerequisite);
        rule.setStatus("ACTIVE");
        return rule;
    }
}
