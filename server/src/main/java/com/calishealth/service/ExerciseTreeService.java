package com.calishealth.service;

import com.calishealth.dtos.ExerciseTreeNodeDTO;
import com.calishealth.dtos.ExerciseTreeResponseDTO;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.ExerciseTreeEdge;
import com.calishealth.models.MemberExerciseProgress;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.ExerciseTreeEdgeRepository;
import com.calishealth.repository.MemberExerciseProgressRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ExerciseTreeService {
    public enum TreeOrder { EASY_TO_HARD, HARD_TO_EASY }

    private final ExerciseRepository exercises;
    private final ExerciseTreeEdgeRepository edges;
    private final MemberExerciseProgressRepository progress;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public ExerciseTreeResponseDTO getTree(
            ExerciseEntry.MovementGroup movementGroup,
            TreeOrder order,
            String memberEmail
    ) {
        if (movementGroup == null || order == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Movement group and order are required");
        }
        Long memberId = users.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated member not found"))
                .getId();

        List<ExerciseEntry> groupExercises = new ArrayList<>(
                exercises.findAllByMovementGroupAndIsSystemTrueAndStatus(
                        movementGroup,
                        ExerciseEntry.EntryStatus.ACCEPTED));
        Comparator<ExerciseEntry> comparator = Comparator
                .comparing(ExerciseEntry::getTreeLevel, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(ExerciseEntry::getId);
        if (order == TreeOrder.HARD_TO_EASY) {
            comparator = comparator.reversed();
        }
        groupExercises.sort(comparator);

        if (groupExercises.isEmpty()) {
            return response(movementGroup, order, List.of());
        }

        Set<Long> exerciseIds = new HashSet<>();
        groupExercises.forEach(exercise -> exerciseIds.add(exercise.getId()));
        Map<Long, List<Long>> prerequisites = new HashMap<>();
        Map<Long, List<Long>> nextExercises = new HashMap<>();
        for (ExerciseEntry exercise : groupExercises) {
            prerequisites.put(exercise.getId(), new ArrayList<>());
            nextExercises.put(exercise.getId(), new ArrayList<>());
        }
        for (ExerciseTreeEdge edge : edges.findAllConnectedTo(exerciseIds)) {
            if (exerciseIds.contains(edge.getParentExerciseId())
                    && exerciseIds.contains(edge.getChildExerciseId())) {
                nextExercises.get(edge.getParentExerciseId()).add(edge.getChildExerciseId());
                prerequisites.get(edge.getChildExerciseId()).add(edge.getParentExerciseId());
            }
        }
        prerequisites.values().forEach(ids -> ids.sort(Long::compareTo));
        nextExercises.values().forEach(ids -> ids.sort(Long::compareTo));

        Map<Long, MemberExerciseProgress.ProgressStatus> storedStates = new HashMap<>();
        progress.findAllByMemberIdAndExerciseIdIn(memberId, exerciseIds)
                .forEach(item -> storedStates.put(item.getExerciseId(), item.getStatus()));

        Map<Long, String> states = new HashMap<>();
        for (ExerciseEntry exercise : groupExercises.stream()
                .sorted(Comparator.comparing(ExerciseEntry::getTreeLevel,
                        Comparator.nullsLast(Integer::compareTo)).thenComparing(ExerciseEntry::getId))
                .toList()) {
            Long id = exercise.getId();
            MemberExerciseProgress.ProgressStatus savedState = storedStates.get(id);
            if (savedState == MemberExerciseProgress.ProgressStatus.MASTERED
                    || savedState == MemberExerciseProgress.ProgressStatus.CURRENT) {
                states.put(id, savedState.name());
            } else {
                List<Long> required = prerequisites.get(id);
                boolean unlocked = required.isEmpty()
                        || required.stream().allMatch(parent -> "MASTERED".equals(states.get(parent)));
                states.put(id, unlocked ? "CURRENT" : "LOCKED");
            }
        }

        List<ExerciseTreeNodeDTO> nodes = groupExercises.stream()
                .map(exercise -> new ExerciseTreeNodeDTO(
                        exercise.getId(),
                        exercise.getName(),
                        exercise.getTreeLevel(),
                        displayDifficulty(exercise.getDifficulty()),
                        exercise.getMovementGroup().name(),
                        states.get(exercise.getId()),
                        List.copyOf(prerequisites.get(exercise.getId())),
                        List.copyOf(nextExercises.get(exercise.getId())),
                        exercise.getMuscleGroup()))
                .toList();
        return response(movementGroup, order, nodes);
    }

    private ExerciseTreeResponseDTO response(
            ExerciseEntry.MovementGroup movementGroup,
            TreeOrder order,
            List<ExerciseTreeNodeDTO> nodes
    ) {
        Map<String, String> legend = new LinkedHashMap<>();
        legend.put("MASTERED", "Mastered");
        legend.put("CURRENT", "Current");
        legend.put("LOCKED", "Locked");
        return new ExerciseTreeResponseDTO(movementGroup.name(), order.name(), nodes, legend);
    }

    private String displayDifficulty(ExerciseEntry.TreeDifficulty difficulty) {
        if (difficulty == null) return null;
        String value = difficulty.name().toLowerCase(java.util.Locale.ROOT);
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }
}
