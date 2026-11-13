package com.calishealth.service;

import com.calishealth.dtos.ExerciseTreeEdgeDTO;
import com.calishealth.dtos.ExerciseTreeNodeDTO;
import com.calishealth.dtos.ExerciseTreeResponseDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.MemberSkillProgress;
import com.calishealth.models.ProgressionRule;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberSkillProgressRepository;
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
import java.util.PriorityQueue;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ExerciseTreeService {
    public enum TreeOrder { EASY_TO_HARD, HARD_TO_EASY }

    private final ProgressionRuleService progressionRules;
    private final MemberSkillProgressRepository skillProgress;
    private final MemberProfileRepository memberProfiles;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public ExerciseTreeResponseDTO getTree(TreeOrder order, String memberEmail) {
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tree order is required");
        }
        Long memberId = users.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated member not found"))
                .getId();

        List<ProgressionRule> allRules = progressionRules.orderedTreeRules();
        Map<Long, Exercise> exercises = new LinkedHashMap<>();
        Map<Long, Set<Long>> prerequisites = new HashMap<>();
        Map<Long, Set<Long>> activePrerequisites = new HashMap<>();
        Map<Long, Set<Long>> nextExercises = new HashMap<>();
        for (ProgressionRule rule : allRules) {
            Exercise exercise = rule.getExercise();
            Exercise prerequisite = rule.getPrerequisiteExercise();
            exercises.putIfAbsent(prerequisite.getId(), prerequisite);
            exercises.putIfAbsent(exercise.getId(), exercise);
            prerequisites.computeIfAbsent(exercise.getId(), ignored -> new HashSet<>()).add(prerequisite.getId());
            nextExercises.computeIfAbsent(prerequisite.getId(), ignored -> new HashSet<>()).add(exercise.getId());
            if (ProgressionRuleService.STATUS_ACTIVE.equals(rule.getStatus())) {
                activePrerequisites.computeIfAbsent(exercise.getId(), ignored -> new HashSet<>()).add(prerequisite.getId());
            }
        }

        Set<Long> exerciseIds = exercises.keySet();
        Map<Long, String> storedStates = exerciseIds.isEmpty()
                ? Map.of()
                : loadSkillStates(memberId, exerciseIds);
        Map<Long, String> states = resolveStates(exercises, prerequisites, activePrerequisites, storedStates);

        Comparator<Exercise> comparator = Comparator
                .comparing(Exercise::getTreeLevel, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(Exercise::getId);
        if (order == TreeOrder.HARD_TO_EASY) comparator = comparator.reversed();
        List<ExerciseTreeNodeDTO> nodes = exercises.values().stream()
                .sorted(comparator)
                .map(exercise -> new ExerciseTreeNodeDTO(
                        exercise.getId(),
                        exercise.getCode(),
                        exercise.getName(),
                        exercise.getType(),
                        exercise.getCategory(),
                        exercise.getTreeLevel(),
                        displayDifficulty(exercise.getDifficultyLevel()),
                        exercise.getMovementGroup() == null ? null : exercise.getMovementGroup().name(),
                        states.get(exercise.getId()),
                        sortedIds(prerequisites.get(exercise.getId())),
                        sortedIds(nextExercises.get(exercise.getId())),
                        exercise.getMuscleGroup()))
                .toList();
        List<ExerciseTreeEdgeDTO> edges = allRules.stream()
                .map(rule -> new ExerciseTreeEdgeDTO(
                        rule.getId(),
                        rule.getStatus(),
                        rule.getPrerequisiteExercise().getCode(),
                        rule.getExercise().getCode()))
                .toList();
        return response(order, nodes, edges);
    }

    /**
     * Đọc trạng thái tiến độ của member trên các bài trong cây.
     *
     * <p>Nguồn sự thật là {@code member_skill_progress} (bảng {@code ProgressionRuleService} ghi khi
     * member tập xong bài và mở khoá bài kế tiếp): {@code UNLOCKED} = đã chinh phục, còn lại
     * ({@code IN_PROGRESS} / chưa có dòng) = đang tập. Trạng thái trả về dùng đúng 3 giá trị mà
     * frontend dựng cây: MASTERED / CURRENT / LOCKED.
     */
    private Map<Long, String> loadSkillStates(Long memberId, Set<Long> exerciseIds) {
        MemberProfile profile = memberProfiles.findByUserId(memberId).orElse(null);
        if (profile == null) {
            return Map.of();
        }
        Map<Long, String> states = new HashMap<>();
        for (MemberSkillProgress row : skillProgress.findAllByMemberProfile_IdAndExercise_IdIn(
                profile.getId(), exerciseIds)) {
            Long exerciseId = row.getExercise() == null ? null : row.getExercise().getId();
            if (exerciseId == null) {
                continue;
            }
            String status = row.getStatus();
            states.put(exerciseId, ProgressionRuleService.PROGRESS_UNLOCKED.equals(status)
                    ? "MASTERED"
                    : "CURRENT");
        }
        return states;
    }

    private Map<Long, String> resolveStates(
            Map<Long, Exercise> exercises,
            Map<Long, Set<Long>> prerequisites,
            Map<Long, Set<Long>> activePrerequisites,
            Map<Long, String> storedStates
    ) {
        Comparator<Long> byDifficulty = Comparator
                .comparing((Long id) -> exercises.get(id).getTreeLevel(), Comparator.nullsLast(Integer::compareTo))
                .thenComparingLong(Long::longValue);
        Map<Long, Integer> remainingPrerequisites = new HashMap<>();
        Map<Long, List<Long>> nextExercises = new HashMap<>();
        exercises.keySet().forEach(id -> remainingPrerequisites.put(id, 0));
        activePrerequisites.forEach((exerciseId, prerequisiteIds) -> {
            remainingPrerequisites.put(exerciseId, prerequisiteIds.size());
            prerequisiteIds.forEach(prerequisiteId ->
                    nextExercises.computeIfAbsent(prerequisiteId, ignored -> new ArrayList<>()).add(exerciseId));
        });

        PriorityQueue<Long> ready = new PriorityQueue<>(byDifficulty);
        remainingPrerequisites.forEach((id, count) -> {
            if (count == 0) ready.add(id);
        });

        Map<Long, String> states = new HashMap<>();
        while (!ready.isEmpty()) {
            Long id = ready.remove();
            String savedState = storedStates.get(id);
            if ("MASTERED".equals(savedState) || "CURRENT".equals(savedState)) {
                states.put(id, savedState);
            } else if (activePrerequisites.containsKey(id)) {
                boolean unlocked = activePrerequisites.get(id).stream()
                        .allMatch(prerequisiteId -> "MASTERED".equals(states.get(prerequisiteId)));
                states.put(id, unlocked ? "CURRENT" : "LOCKED");
            } else {
                states.put(id, "CURRENT");
            }

            for (Long nextId : nextExercises.getOrDefault(id, List.of())) {
                int remaining = remainingPrerequisites.compute(nextId, (ignored, count) -> count - 1);
                if (remaining == 0) ready.add(nextId);
            }
        }

        exercises.keySet().forEach(id -> states.putIfAbsent(id, "LOCKED"));
        return states;
    }

    private List<Long> sortedIds(Set<Long> ids) {
        return ids == null ? List.of() : ids.stream().sorted().toList();
    }

    private ExerciseTreeResponseDTO response(
            TreeOrder order,
            List<ExerciseTreeNodeDTO> nodes,
            List<ExerciseTreeEdgeDTO> edges
    ) {
        Map<String, String> legend = new LinkedHashMap<>();
        legend.put("MASTERED", "Mastered");
        legend.put("CURRENT", "Current");
        legend.put("LOCKED", "Locked");
        return new ExerciseTreeResponseDTO("ALL", order.name(), nodes, edges, legend);
    }

    private String displayDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) return null;
        String value = difficulty.trim().toLowerCase(java.util.Locale.ROOT);
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }
}
