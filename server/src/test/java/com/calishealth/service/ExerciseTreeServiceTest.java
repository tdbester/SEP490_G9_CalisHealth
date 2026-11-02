package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseTreeEdge;
import com.calishealth.models.MemberExerciseProgress;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.ExerciseTreeEdgeRepository;
import com.calishealth.repository.MemberExerciseProgressRepository;
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
    private ExerciseRepository exercises;
    private ExerciseTreeEdgeRepository edges;
    private MemberExerciseProgressRepository progress;
    private UserRepository users;
    private ExerciseTreeService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        edges = mock(ExerciseTreeEdgeRepository.class);
        progress = mock(MemberExerciseProgressRepository.class);
        users = mock(UserRepository.class);
        service = new ExerciseTreeService(exercises, edges, progress, users);
    }

    @Test
    void sortsTreeAndUnlocksOnlyNodesWhosePrerequisitesAreMastered() {
        User member = new User();
        member.setId(5L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        Exercise levelOne = entry(101L, "Incline push-up", 1);
        Exercise levelTwo = entry(102L, "Push-up", 2);
        Exercise levelThree = entry(103L, "Diamond push-up", 3);
        when(exercises.findAllByMovementGroupAndSystemTrueAndStatus(
                Exercise.MovementGroup.PUSH,
                Exercise.EntryStatus.ACCEPTED.name()))
                .thenReturn(List.of(levelThree, levelOne, levelTwo));
        when(edges.findAllConnectedTo(anyCollection()))
                .thenReturn(List.of(edge(101L, 102L), edge(102L, 103L)));

        MemberExerciseProgress mastered = new MemberExerciseProgress();
        mastered.setExerciseId(101L);
        mastered.setStatus(MemberExerciseProgress.ProgressStatus.MASTERED);
        when(progress.findAllByMemberIdAndExerciseIdIn(eq(5L), anyCollection()))
                .thenReturn(List.of(mastered));

        var result = service.getTree(
                Exercise.MovementGroup.PUSH,
                ExerciseTreeService.TreeOrder.HARD_TO_EASY,
                "member@example.com");

        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::id).containsExactly(103L, 102L, 101L);
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::code).containsExactly("EX-103", "EX-102", "EX-101");
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::state).containsExactly("LOCKED", "CURRENT", "MASTERED");
        assertThat(result.nodes().get(1).prerequisiteIds()).containsExactly(101L);
        assertThat(result.nodes().get(1).nextExerciseIds()).containsExactly(103L);
    }

    private Exercise entry(Long id, String name, int level) {
        Exercise entry = new Exercise();
        entry.setId(id);
        entry.setCode("EX-" + id);
        entry.setName(name);
        entry.setMovementGroup(Exercise.MovementGroup.PUSH);
        entry.setTreeLevel(level);
        entry.setDifficulty(Exercise.TreeDifficulty.BEGINNER);
        entry.setMuscleGroup("Chest");
        return entry;
    }

    private ExerciseTreeEdge edge(Long parentId, Long childId) {
        ExerciseTreeEdge edge = new ExerciseTreeEdge();
        edge.setParentExerciseId(parentId);
        edge.setChildExerciseId(childId);
        return edge;
    }
}
