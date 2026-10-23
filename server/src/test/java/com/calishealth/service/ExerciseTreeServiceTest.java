package com.calishealth.service;

import com.calishealth.models.ExerciseEntry;
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

        ExerciseEntry levelOne = entry(101L, "Incline push-up", 1);
        ExerciseEntry levelTwo = entry(102L, "Push-up", 2);
        ExerciseEntry levelThree = entry(103L, "Diamond push-up", 3);
        when(exercises.findAllByMovementGroupAndIsSystemTrueAndStatus(
                ExerciseEntry.MovementGroup.PUSH,
                ExerciseEntry.EntryStatus.ACCEPTED))
                .thenReturn(List.of(levelThree, levelOne, levelTwo));
        when(edges.findAllConnectedTo(anyCollection()))
                .thenReturn(List.of(edge(101L, 102L), edge(102L, 103L)));

        MemberExerciseProgress mastered = new MemberExerciseProgress();
        mastered.setExerciseId(101L);
        mastered.setStatus(MemberExerciseProgress.ProgressStatus.MASTERED);
        when(progress.findAllByMemberIdAndExerciseIdIn(eq(5L), anyCollection()))
                .thenReturn(List.of(mastered));

        var result = service.getTree(
                ExerciseEntry.MovementGroup.PUSH,
                ExerciseTreeService.TreeOrder.HARD_TO_EASY,
                "member@example.com");

        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::id).containsExactly(103L, 102L, 101L);
        assertThat(result.nodes()).extracting(
                com.calishealth.dtos.ExerciseTreeNodeDTO::state).containsExactly("LOCKED", "CURRENT", "MASTERED");
        assertThat(result.nodes().get(1).prerequisiteIds()).containsExactly(101L);
        assertThat(result.nodes().get(1).nextExerciseIds()).containsExactly(103L);
    }

    private ExerciseEntry entry(Long id, String name, int level) {
        ExerciseEntry entry = new ExerciseEntry();
        entry.setId(id);
        entry.setName(name);
        entry.setMovementGroup(ExerciseEntry.MovementGroup.PUSH);
        entry.setTreeLevel(level);
        entry.setDifficulty(ExerciseEntry.TreeDifficulty.BEGINNER);
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
