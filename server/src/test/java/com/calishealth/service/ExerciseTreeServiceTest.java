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
    private ExerciseTreeService service;

    @BeforeEach
    void setUp() {
        progressionRules = mock(ProgressionRuleService.class);
        skillProgress = mock(MemberSkillProgressRepository.class);
        memberProfiles = mock(MemberProfileRepository.class);
        users = mock(UserRepository.class);
        service = new ExerciseTreeService(progressionRules, skillProgress, memberProfiles, users);
    }

    @Test
    void sortsTreeAndUnlocksOnlyNodesWhosePrerequisitesAreMastered() {
        User member = new User();
        member.setId(5L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        MemberProfile profile = new MemberProfile();
        profile.setId(77L);
        when(memberProfiles.findByUserId(5L)).thenReturn(Optional.of(profile));

        Exercise levelOne = entry(101L, "Incline push-up", 1);
        Exercise levelTwo = entry(102L, "Push-up", 2);
        Exercise levelThree = entry(103L, "Diamond push-up", 3);
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(
                rule(levelTwo, levelOne),
                rule(levelThree, levelTwo)));

        // member đã chinh phục bài level 1 -> trạng thái MASTERED trong cây.
        when(skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(eq(77L), anyCollection()))
                .thenReturn(List.of(skill(levelOne, ProgressionRuleService.PROGRESS_UNLOCKED)));

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

        Exercise plank = entry(201L, "Plank", 1);
        Exercise handstand = entry(202L, "Handstand", 2);
        handstand.setMovementGroup(Exercise.MovementGroup.PUSH);
        ProgressionRule activeRule = rule(handstand, plank);
        ProgressionRule inactiveRule = rule(entry(203L, "Hollow Body Hold", 2), plank);
        inactiveRule.setStatus("INACTIVE");
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(activeRule, inactiveRule));
        when(skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(eq(77L), anyCollection()))
                .thenReturn(List.of());

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

        Exercise levelOne = entry(101L, "Incline push-up", 1);
        Exercise levelTwo = entry(102L, "Push-up", 2);
        when(progressionRules.orderedTreeRules()).thenReturn(List.of(rule(levelTwo, levelOne)));

        var result = service.getTree(
                ExerciseTreeService.TreeOrder.EASY_TO_HARD,
                "member@example.com");

        // Không có hồ sơ -> không có dòng tiến độ nào: bài gốc CURRENT, bài có prerequisite chưa
        // chinh phục thì LOCKED (giống hệt logic cây trước khi bỏ member_exercise_progress).
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::state).containsExactly("CURRENT", "LOCKED");
    }

    private MemberSkillProgress skill(Exercise exercise, String status) {
        MemberSkillProgress progress = new MemberSkillProgress();
        progress.setExercise(exercise);
        progress.setStatus(status);
        return progress;
    }

    private Exercise entry(Long id, String name, int level) {
        Exercise entry = new Exercise();
        entry.setId(id);
        entry.setCode("EX-" + id);
        entry.setName(name);
        entry.setSource("SYSTEM");
        entry.setMovementGroup(Exercise.MovementGroup.PUSH);
        entry.setTreeLevel(level);
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
